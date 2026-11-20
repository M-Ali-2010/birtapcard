-- Forward-only idempotent migration for BirTapCard Restaurant UX Enhancements
-- Adds idempotency client_request_id, cancellation tracking, review tags and service requests.

-- 1. Orders enhancements
alter table if exists public.restaurant_orders
  add column if not exists client_request_id uuid,
  add column if not exists cancelled_by text check (cancelled_by is null or cancelled_by in ('guest', 'staff', 'kitchen', 'system')),
  add column if not exists cancel_reason text;

create unique index if not exists idx_restaurant_orders_client_req
  on public.restaurant_orders (restaurant_id, client_request_id)
  where client_request_id is not null;

-- 2. Review tags enhancement
alter table if exists public.restaurant_reviews
  add column if not exists tags text[] not null default '{}'::text[];

-- 3. Service requests table (call waiter, request bill, etc.)
create table if not exists public.restaurant_service_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null,
  kind text not null check (kind in ('waiter', 'bill', 'cutlery', 'water', 'custom')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved', 'cancelled')),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (restaurant_id, table_id) references public.dining_tables(restaurant_id, id) on delete cascade
);

create index if not exists idx_service_requests_active
  on public.restaurant_service_requests (restaurant_id, status, created_at desc);

-- RLS for restaurant_service_requests
alter table public.restaurant_service_requests enable row level security;

create policy "Staff can manage service requests for their restaurant"
  on public.restaurant_service_requests
  for all
  to authenticated
  using (
    exists (
      select 1 from public.restaurant_users ru
      where ru.restaurant_id = restaurant_service_requests.restaurant_id
        and ru.user_id = auth.uid()
    ) or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'super_admin'
    )
  );

-- 4. Idempotent order creation RPC update
create or replace function public.create_public_restaurant_order(
  p_restaurant_slug text,
  p_table_number text,
  p_items jsonb,
  p_customer_note text default null,
  p_client_request_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_table public.dining_tables%rowtype;
  v_order public.restaurant_orders%rowtype;
  v_item jsonb;
  v_product public.menu_products%rowtype;
  v_quantity integer;
  v_modifier_ids uuid[];
  v_modifier_total integer;
  v_modifiers jsonb;
  v_unit_total integer;
  v_total integer := 0;
  v_item_count integer := 0;
begin
  -- Idempotency check: if client_request_id was provided and already exists, return existing order
  if p_client_request_id is not null then
    select o.* into v_order
    from public.restaurant_orders o
    join public.restaurants r on r.id = o.restaurant_id
    where r.slug = p_restaurant_slug and o.client_request_id = p_client_request_id;

    if found then
      return jsonb_build_object(
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'tracking_token', v_order.tracking_token,
        'total_uzs', v_order.total_uzs,
        'status', v_order.status,
        'is_duplicate', true
      );
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'Invalid order items';
  end if;
  if p_customer_note is not null and length(p_customer_note) > 1000 then
    raise exception using errcode = '22023', message = 'Order note is too long';
  end if;

  select * into v_restaurant from public.restaurants
    where slug = p_restaurant_slug and active and is_published;
  if not found then raise exception using errcode = 'P0002', message = 'Restaurant not found'; end if;

  select * into v_table from public.dining_tables
    where restaurant_id = v_restaurant.id and table_number = p_table_number and active;
  if not found then raise exception using errcode = 'P0002', message = 'Table not found'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_count := v_item_count + 1;
    if (v_item->>'product_id') is null then raise exception using errcode = '22023', message = 'Product is required'; end if;
    begin
      v_quantity := (v_item->>'quantity')::integer;
    exception when others then raise exception using errcode = '22023', message = 'Invalid quantity';
    end;
    if v_quantity < 1 or v_quantity > 50 then raise exception using errcode = '22023', message = 'Invalid quantity'; end if;

    select * into v_product from public.menu_products p
      where p.id = (v_item->>'product_id')::uuid
        and p.restaurant_id = v_restaurant.id
        and p.available and p.deleted_at is null
        and exists (select 1 from public.menu_categories c where c.id=p.category_id and c.restaurant_id=p.restaurant_id and c.active and c.deleted_at is null);
    if not found then raise exception using errcode = '22023', message = 'Menu item is unavailable'; end if;

    select coalesce(array_agg(distinct x::uuid), '{}'::uuid[]) into v_modifier_ids
      from jsonb_array_elements_text(coalesce(v_item->'modifier_ids', '[]'::jsonb)) x;
    if exists (
      select 1 from unnest(v_modifier_ids) selected(id)
      where not exists (
        select 1 from public.product_modifiers m
        join public.product_modifier_groups g on g.id = m.group_id and g.restaurant_id = m.restaurant_id
        where m.id = selected.id and m.restaurant_id = v_restaurant.id and m.available and g.active and g.product_id = v_product.id
      )
    ) then raise exception using errcode = '22023', message = 'Invalid modifier selection'; end if;

    if exists (
      select 1 from public.product_modifier_groups g
      where g.restaurant_id = v_restaurant.id and g.product_id = v_product.id and g.active
        and ((g.required and (select count(*) from unnest(v_modifier_ids) s(id) join public.product_modifiers m on m.id=s.id where m.group_id=g.id) < greatest(g.min_select, 1))
          or (select count(*) from unnest(v_modifier_ids) s(id) join public.product_modifiers m on m.id=s.id where m.group_id=g.id) > g.max_select)
    ) then raise exception using errcode = '22023', message = 'Choose the required options'; end if;

    select coalesce(sum(m.price_delta_uzs), 0), coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'price_delta_uzs',m.price_delta_uzs) order by m.sort_order), '[]'::jsonb)
      into v_modifier_total, v_modifiers
      from public.product_modifiers m where m.id = any(v_modifier_ids) and m.restaurant_id = v_restaurant.id;
    v_unit_total := v_product.price_uzs + v_modifier_total;
    v_total := v_total + (v_unit_total * v_quantity);
  end loop;

  insert into public.restaurant_orders (
    restaurant_id, table_id, customer_note, total_uzs, status, client_request_id
  ) values (
    v_restaurant.id, v_table.id, p_customer_note, v_total, 'new', p_client_request_id
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.menu_products where id = (v_item->>'product_id')::uuid;
    select coalesce(array_agg(distinct x::uuid), '{}'::uuid[]) into v_modifier_ids
      from jsonb_array_elements_text(coalesce(v_item->'modifier_ids', '[]'::jsonb)) x;
    select coalesce(sum(m.price_delta_uzs), 0), coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'price_delta_uzs',m.price_delta_uzs) order by m.sort_order), '[]'::jsonb)
      into v_modifier_total, v_modifiers
      from public.product_modifiers m where m.id = any(v_modifier_ids) and m.restaurant_id = v_restaurant.id;
    v_unit_total := v_product.price_uzs + v_modifier_total;

    insert into public.restaurant_order_items (
      restaurant_id, order_id, product_id, product_name, quantity,
      unit_price_uzs, modifiers, note, line_total_uzs
    ) values (
      v_restaurant.id, v_order.id, v_product.id, v_product.name, v_quantity,
      v_unit_total, v_modifiers, nullif(trim(v_item->>'note'), ''), (v_unit_total * v_quantity)
    );
  end loop;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'tracking_token', v_order.tracking_token,
    'total_uzs', v_order.total_uzs,
    'status', v_order.status,
    'is_duplicate', false
  );
end;
$$;
