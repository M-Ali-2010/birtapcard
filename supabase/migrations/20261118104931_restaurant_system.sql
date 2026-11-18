-- BirTapCard Restaurant System: menu, table ordering, restaurant staff, KDS and reviews.
-- Core BirTapCard tables are left untouched. Run after the existing base schema and 0001_rls_hardening.sql.

create extension if not exists pgcrypto;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  logo_url text,
  cover_url text,
  phone text,
  address text,
  currency text not null default 'UZS' check (currency = 'UZS'),
  timezone text not null default 'Asia/Tashkent',
  is_published boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_users (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('restaurant_admin', 'staff', 'kitchen')),
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create table if not exists public.restaurant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  plan_name text not null default 'restaurant',
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, slug),
  unique (restaurant_id, id)
);

create table if not exists public.menu_products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null,
  name text not null,
  slug text not null,
  description text,
  ingredients text,
  allergens text[] not null default '{}',
  portion text,
  image_url text,
  price_uzs integer not null check (price_uzs >= 0),
  preparation_minutes smallint check (preparation_minutes is null or preparation_minutes between 0 and 240),
  is_popular boolean not null default false,
  is_new boolean not null default false,
  available boolean not null default true,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, category_id) references public.menu_categories(restaurant_id, id) on delete restrict,
  unique (restaurant_id, slug),
  unique (restaurant_id, id)
);

create table if not exists public.product_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null,
  name text not null,
  required boolean not null default false,
  min_select smallint not null default 0 check (min_select >= 0),
  max_select smallint not null default 1 check (max_select between 1 and 20),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, product_id) references public.menu_products(restaurant_id, id) on delete cascade,
  unique (restaurant_id, id)
);

create table if not exists public.product_modifiers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  group_id uuid not null,
  name text not null,
  price_delta_uzs integer not null default 0 check (price_delta_uzs >= 0),
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, group_id) references public.product_modifier_groups(restaurant_id, id) on delete cascade
);

create table if not exists public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number text not null check (length(table_number) between 1 and 12),
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, table_number),
  unique (restaurant_id, id)
);

create table if not exists public.restaurant_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  table_id uuid not null,
  order_number bigint generated by default as identity,
  tracking_token uuid not null default gen_random_uuid() unique,
  status text not null default 'new' check (status in ('new', 'accepted', 'preparing', 'ready', 'delivered', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  payment_method text check (payment_method is null or payment_method in ('cash', 'card', 'terminal', 'other')),
  customer_note text,
  total_uzs integer not null check (total_uzs >= 0),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, table_id) references public.dining_tables(restaurant_id, id) on delete restrict,
  unique (restaurant_id, order_number),
  unique (restaurant_id, id)
);

create table if not exists public.restaurant_order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  order_id uuid not null,
  product_id uuid references public.menu_products(id) on delete set null,
  product_name text not null,
  quantity smallint not null check (quantity between 1 and 50),
  unit_price_uzs integer not null check (unit_price_uzs >= 0),
  modifiers jsonb not null default '[]'::jsonb,
  note text,
  line_total_uzs integer not null check (line_total_uzs >= 0),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, order_id) references public.restaurant_orders(restaurant_id, id) on delete cascade
);

create table if not exists public.restaurant_order_status_history (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  order_id uuid not null,
  from_status text,
  to_status text not null check (to_status in ('new', 'accepted', 'preparing', 'ready', 'delivered', 'completed', 'cancelled')),
  actor_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, order_id) references public.restaurant_orders(restaurant_id, id) on delete cascade
);

create table if not exists public.restaurant_payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  order_id uuid not null,
  amount_uzs integer not null check (amount_uzs >= 0),
  method text not null check (method in ('cash', 'card', 'terminal', 'other')),
  recorded_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, order_id) references public.restaurant_orders(restaurant_id, id) on delete restrict
);

create table if not exists public.restaurant_reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  order_id uuid not null,
  table_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  sentiment text check (sentiment is null or sentiment in ('excellent', 'good', 'okay', 'concern')),
  comment text check (comment is null or length(comment) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, order_id) references public.restaurant_orders(restaurant_id, id) on delete restrict,
  foreign key (restaurant_id, table_id) references public.dining_tables(restaurant_id, id) on delete restrict,
  unique (order_id)
);

create index if not exists restaurant_users_user on public.restaurant_users(user_id, restaurant_id);
create index if not exists restaurant_subscriptions_tenant on public.restaurant_subscriptions(restaurant_id, status);
create index if not exists menu_categories_tenant_sort on public.menu_categories(restaurant_id, active, sort_order);
create index if not exists menu_products_tenant_category on public.menu_products(restaurant_id, category_id, available, sort_order) where deleted_at is null;
create index if not exists modifiers_product on public.product_modifier_groups(restaurant_id, product_id, sort_order);
create index if not exists dining_tables_tenant on public.dining_tables(restaurant_id, table_number);
create index if not exists restaurant_orders_tenant_created on public.restaurant_orders(restaurant_id, created_at desc);
create index if not exists restaurant_orders_active on public.restaurant_orders(restaurant_id, status, created_at) where status not in ('completed', 'cancelled');
create index if not exists restaurant_order_items_order on public.restaurant_order_items(restaurant_id, order_id);
create index if not exists restaurant_order_history_order on public.restaurant_order_status_history(restaurant_id, order_id, created_at);
create index if not exists restaurant_payments_order on public.restaurant_payments(restaurant_id, order_id, created_at desc);
create index if not exists restaurant_reviews_tenant on public.restaurant_reviews(restaurant_id, created_at desc);

create or replace function public.has_restaurant_role(p_restaurant_id uuid, p_roles text[] default null)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.restaurant_users ru
      where ru.restaurant_id = p_restaurant_id
        and ru.user_id = auth.uid()
        and (p_roles is null or ru.role = any(p_roles))
    )
$$;

create or replace function public.touch_restaurant_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'restaurants', 'restaurant_subscriptions', 'menu_categories', 'menu_products',
    'product_modifier_groups', 'product_modifiers', 'dining_tables', 'restaurant_orders'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_restaurant_updated_at()', 'trg_' || t || '_updated_at', t);
  end loop;
end $$;

-- Tenant and menu reads. Public visitors only see a published, active restaurant.
alter table public.restaurants enable row level security;
alter table public.restaurant_users enable row level security;
alter table public.restaurant_subscriptions enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_products enable row level security;
alter table public.product_modifier_groups enable row level security;
alter table public.product_modifiers enable row level security;
alter table public.dining_tables enable row level security;
alter table public.restaurant_orders enable row level security;
alter table public.restaurant_order_items enable row level security;
alter table public.restaurant_order_status_history enable row level security;
alter table public.restaurant_payments enable row level security;
alter table public.restaurant_reviews enable row level security;

drop policy if exists restaurants_public_read on public.restaurants;
create policy restaurants_public_read on public.restaurants for select to anon, authenticated
  using (active and is_published);
drop policy if exists restaurants_member_read on public.restaurants;
create policy restaurants_member_read on public.restaurants for select to authenticated
  using (public.has_restaurant_role(id));
drop policy if exists restaurants_admin_write on public.restaurants;
create policy restaurants_admin_write on public.restaurants for all to authenticated
  using (public.is_super_admin() or public.has_restaurant_role(id, array['restaurant_admin']))
  with check (public.is_super_admin() or public.has_restaurant_role(id, array['restaurant_admin']));

drop policy if exists restaurant_users_self_read on public.restaurant_users;
create policy restaurant_users_self_read on public.restaurant_users for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']));
drop policy if exists restaurant_users_admin_write on public.restaurant_users;
create policy restaurant_users_admin_write on public.restaurant_users for all to authenticated
  using (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']))
  with check (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']));

drop policy if exists restaurant_subscriptions_admin_read on public.restaurant_subscriptions;
create policy restaurant_subscriptions_admin_read on public.restaurant_subscriptions for select to authenticated
  using (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']));
drop policy if exists restaurant_subscriptions_super_admin_write on public.restaurant_subscriptions;
create policy restaurant_subscriptions_super_admin_write on public.restaurant_subscriptions for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists menu_categories_public_read on public.menu_categories;
create policy menu_categories_public_read on public.menu_categories for select to anon, authenticated
  using (active and deleted_at is null and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.active and r.is_published));
drop policy if exists menu_categories_member_read on public.menu_categories;
create policy menu_categories_member_read on public.menu_categories for select to authenticated using (public.has_restaurant_role(restaurant_id));
drop policy if exists menu_categories_admin_write on public.menu_categories;
create policy menu_categories_admin_write on public.menu_categories for all to authenticated
  using (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']))
  with check (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']));

drop policy if exists menu_products_public_read on public.menu_products;
create policy menu_products_public_read on public.menu_products for select to anon, authenticated
  using (available and deleted_at is null and exists (
    select 1 from public.restaurants r join public.menu_categories c on c.restaurant_id = r.id
    where r.id = restaurant_id and r.active and r.is_published and c.id = category_id and c.active and c.deleted_at is null
  ));
drop policy if exists menu_products_member_read on public.menu_products;
create policy menu_products_member_read on public.menu_products for select to authenticated using (public.has_restaurant_role(restaurant_id));
drop policy if exists menu_products_admin_write on public.menu_products;
create policy menu_products_admin_write on public.menu_products for all to authenticated
  using (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']))
  with check (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']));

drop policy if exists modifier_groups_public_read on public.product_modifier_groups;
create policy modifier_groups_public_read on public.product_modifier_groups for select to anon, authenticated
  using (active and exists (select 1 from public.restaurants r join public.menu_products p on p.restaurant_id=r.id
    where r.id=restaurant_id and r.active and r.is_published and p.id=product_id and p.available and p.deleted_at is null));
drop policy if exists modifier_groups_member_read on public.product_modifier_groups;
create policy modifier_groups_member_read on public.product_modifier_groups for select to authenticated using (public.has_restaurant_role(restaurant_id));
drop policy if exists modifier_groups_admin_write on public.product_modifier_groups;
create policy modifier_groups_admin_write on public.product_modifier_groups for all to authenticated
  using (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']))
  with check (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']));

drop policy if exists modifiers_public_read on public.product_modifiers;
create policy modifiers_public_read on public.product_modifiers for select to anon, authenticated
  using (available and exists (select 1 from public.restaurants r join public.product_modifier_groups g on g.restaurant_id=r.id
    where r.id=restaurant_id and r.active and r.is_published and g.id=group_id and g.active));
drop policy if exists modifiers_member_read on public.product_modifiers;
create policy modifiers_member_read on public.product_modifiers for select to authenticated using (public.has_restaurant_role(restaurant_id));
drop policy if exists modifiers_admin_write on public.product_modifiers;
create policy modifiers_admin_write on public.product_modifiers for all to authenticated
  using (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']))
  with check (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']));

drop policy if exists dining_tables_public_read on public.dining_tables;
create policy dining_tables_public_read on public.dining_tables for select to anon, authenticated
  using (active and exists (select 1 from public.restaurants r where r.id=restaurant_id and r.active and r.is_published));
drop policy if exists dining_tables_member_read on public.dining_tables;
create policy dining_tables_member_read on public.dining_tables for select to authenticated using (public.has_restaurant_role(restaurant_id));
drop policy if exists dining_tables_admin_write on public.dining_tables;
create policy dining_tables_admin_write on public.dining_tables for all to authenticated
  using (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']))
  with check (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['restaurant_admin']));

drop policy if exists restaurant_orders_member_read on public.restaurant_orders;
create policy restaurant_orders_member_read on public.restaurant_orders for select to authenticated
  using (public.has_restaurant_role(restaurant_id));
drop policy if exists restaurant_order_items_member_read on public.restaurant_order_items;
create policy restaurant_order_items_member_read on public.restaurant_order_items for select to authenticated
  using (public.has_restaurant_role(restaurant_id));
drop policy if exists restaurant_order_history_member_read on public.restaurant_order_status_history;
create policy restaurant_order_history_member_read on public.restaurant_order_status_history for select to authenticated
  using (public.has_restaurant_role(restaurant_id));
drop policy if exists restaurant_payments_member_read on public.restaurant_payments;
create policy restaurant_payments_member_read on public.restaurant_payments for select to authenticated
  using (public.has_restaurant_role(restaurant_id));
drop policy if exists restaurant_reviews_member_read on public.restaurant_reviews;
create policy restaurant_reviews_member_read on public.restaurant_reviews for select to authenticated
  using (public.has_restaurant_role(restaurant_id));

-- Guests never write prices or tenant IDs directly. This RPC validates the table,
-- products, availability and modifier ownership, then snapshots authoritative prices.
create or replace function public.create_public_restaurant_order(
  p_restaurant_slug text,
  p_table_number text,
  p_items jsonb,
  p_customer_note text default null
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
    v_total := v_total + v_unit_total * v_quantity;
  end loop;

  insert into public.restaurant_orders(restaurant_id, table_id, customer_note, total_uzs)
    values (v_restaurant.id, v_table.id, nullif(trim(p_customer_note), ''), v_total)
    returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product := null;
    select * into v_product from public.menu_products p where p.id = (v_item->>'product_id')::uuid and p.restaurant_id = v_restaurant.id;
    v_quantity := (v_item->>'quantity')::integer;
    select coalesce(array_agg(distinct x::uuid), '{}'::uuid[]) into v_modifier_ids
      from jsonb_array_elements_text(coalesce(v_item->'modifier_ids', '[]'::jsonb)) x;
    select coalesce(sum(m.price_delta_uzs), 0), coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'price_delta_uzs',m.price_delta_uzs) order by m.sort_order), '[]'::jsonb)
      into v_modifier_total, v_modifiers
      from public.product_modifiers m where m.id = any(v_modifier_ids) and m.restaurant_id = v_restaurant.id;
    v_unit_total := v_product.price_uzs + v_modifier_total;
    insert into public.restaurant_order_items(restaurant_id, order_id, product_id, product_name, quantity, unit_price_uzs, modifiers, note, line_total_uzs)
      values (v_restaurant.id, v_order.id, v_product.id, v_product.name, v_quantity, v_unit_total, v_modifiers,
        nullif(trim(v_item->>'note'), ''), v_unit_total * v_quantity);
  end loop;

  insert into public.restaurant_order_status_history(restaurant_id, order_id, to_status)
    values (v_restaurant.id, v_order.id, 'new');

  return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number, 'tracking_token', v_order.tracking_token);
end;
$$;

revoke all on function public.create_public_restaurant_order(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_public_restaurant_order(text, text, jsonb, text) to service_role;

create or replace function public.transition_restaurant_order(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_status text default null,
  p_payment_method text default null,
  p_actor_user_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.restaurant_orders%rowtype;
  v_next text;
begin
  select * into v_order from public.restaurant_orders
    where id = p_order_id and restaurant_id = p_restaurant_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Order not found'; end if;

  if p_status is not null then
    if not (
      (v_order.status = 'new' and p_status in ('accepted','cancelled')) or
      (v_order.status = 'accepted' and p_status in ('preparing','cancelled')) or
      (v_order.status = 'preparing' and p_status in ('ready','cancelled')) or
      (v_order.status = 'ready' and p_status = 'delivered') or
      (v_order.status = 'delivered' and p_status = 'completed')
    ) then raise exception using errcode = '22023', message = 'Invalid order status transition'; end if;
    update public.restaurant_orders set status=p_status,
      accepted_at=case when p_status='accepted' then now() else accepted_at end,
      completed_at=case when p_status='completed' then now() else completed_at end
      where id=p_order_id and restaurant_id=p_restaurant_id;
    insert into public.restaurant_order_status_history(restaurant_id,order_id,from_status,to_status,actor_user_id)
      values (p_restaurant_id,p_order_id,v_order.status,p_status,p_actor_user_id);
  end if;

  if p_payment_method is not null then
    if p_payment_method not in ('cash','card','terminal','other') then
      raise exception using errcode = '22023', message = 'Invalid payment method';
    end if;
    if v_order.payment_status = 'paid' then raise exception using errcode = '22023', message = 'Order is already paid'; end if;
    update public.restaurant_orders set payment_status='paid', payment_method=p_payment_method
      where id=p_order_id and restaurant_id=p_restaurant_id;
    insert into public.restaurant_payments(restaurant_id,order_id,amount_uzs,method,recorded_by)
      values (p_restaurant_id,p_order_id,v_order.total_uzs,p_payment_method,p_actor_user_id);
  end if;
end;
$$;

revoke all on function public.transition_restaurant_order(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.transition_restaurant_order(uuid, uuid, text, text, uuid) to service_role;

-- Synthetic demo data. These rows are labelled as demo in the UI, not presented as a real customer.
insert into public.restaurants(name, slug, description, address, phone, is_published, active)
values ('Bella Italia', 'bella-italia', 'Итальянская кухня и любимые блюда из печи.', 'Ташкент, улица Сайилгох, 7', '+998 71 200 08 08', true, true)
on conflict (slug) do update set name = excluded.name, description = excluded.description, is_published = true, active = true;

insert into public.dining_tables(restaurant_id, table_number)
select r.id, t.n::text from public.restaurants r cross join generate_series(1,8) t(n)
where r.slug = 'bella-italia'
on conflict (restaurant_id, table_number) do nothing;

insert into public.menu_categories(restaurant_id, name, slug, sort_order)
select r.id, c.name, c.slug, c.position from public.restaurants r
cross join (values ('Пицца','pizza',1),('Паста','pasta',2),('Салаты','salads',3),('Основные блюда','mains',4),('Напитки','drinks',5),('Десерты','desserts',6)) c(name,slug,position)
where r.slug = 'bella-italia'
on conflict (restaurant_id, slug) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.menu_products(restaurant_id, category_id, name, slug, description, ingredients, allergens, portion, image_url, price_uzs, preparation_minutes, is_popular, is_new, sort_order)
select r.id, c.id, p.name, p.slug, p.description, p.ingredients, p.allergens::text[], p.portion, p.image_url, p.price, p.prep, p.popular, p.new, p.position
from public.restaurants r
cross join (values
 ('pizza','Маргарита','margherita','Томатный соус, моцарелла и свежий базилик.','Томаты, моцарелла, базилик','{молоко,глютен}','30 см','https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85',72000,14,true,false,1),
 ('pizza','Пепперони','pepperoni','Тонкое тесто, пикантная салями и тягучая моцарелла.','Салями пепперони, моцарелла, томаты','{молоко,глютен}','30 см','https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=900&q=85',89000,16,true,false,2),
 ('pizza','Четыре сыра','four-cheese','Сливочная основа и четыре выразительных сыра.','Моцарелла, горгонзола, пармезан, рикотта','{молоко,глютен}','30 см','https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=900&q=85',96000,16,false,true,3),
 ('pasta','Паста Карбонара','carbonara','Спагетти в соусе из желтка, пармезана и бекона.','Спагетти, бекон, сливки, пармезан','{молоко,глютен,яйцо}','320 г','https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=900&q=85',78000,18,true,false,1),
 ('pasta','Паста Болоньезе','bolognese','Томлёный мясной соус с томатами и травами.','Телятина, томаты, спагетти, пармезан','{молоко,глютен}','340 г','https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=85',82000,20,false,false,2),
 ('salads','Цезарь с курицей','chicken-caesar','Хрустящий романо, курица, пармезан и фирменный соус.','Курица, романо, сухарики, пармезан','{молоко,глютен,яйцо}','280 г','https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=900&q=85',68000,12,true,false,1),
 ('mains','Лосось на гриле','grilled-salmon','Филе лосося с лимоном, зеленью и овощами.','Лосось, лимон, сезонные овощи','{рыба}','300 г','https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=85',145000,24,false,true,1),
 ('drinks','Лимонад цитрусовый','citrus-lemonade','Домашний лимонад с апельсином и мятой.','Апельсин, лимон, мята, содовая','{}','400 мл','https://images.unsplash.com/photo-1513558161293-cdaf765edfd7?auto=format&fit=crop&w=900&q=85',32000,5,false,false,1),
 ('desserts','Тирамису','tiramisu','Нежный крем маскарпоне, кофе и какао.','Маскарпоне, савоярди, кофе','{молоко,глютен,яйцо}','180 г','https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=85',49000,4,true,false,1)
) p(category_slug,name,slug,description,ingredients,allergens,portion,image_url,price,prep,popular,new,position)
join public.menu_categories c on c.restaurant_id = r.id and c.slug = p.category_slug
where r.slug = 'bella-italia'
on conflict (restaurant_id, slug) do update set
  category_id=excluded.category_id, name=excluded.name, description=excluded.description,
  ingredients=excluded.ingredients, allergens=excluded.allergens, portion=excluded.portion,
  image_url=excluded.image_url, price_uzs=excluded.price_uzs,
  preparation_minutes=excluded.preparation_minutes, is_popular=excluded.is_popular,
  is_new=excluded.is_new, sort_order=excluded.sort_order, available=true, deleted_at=null;
