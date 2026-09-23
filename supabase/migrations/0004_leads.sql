-- ═══════════════════════════════════════════════════════════════════════════
-- Заявки из бота (leads).
--
-- До этой миграции бот умел разговаривать только с теми, кто уже клиент:
-- незнакомому человеку он отвечал «привяжите аккаунт в кабинете» — то есть
-- весь трафик с карточек, презентации и @birtapcard упирался в тупик.
-- Теперь непривязанный собеседник проходит воронку прямо в боте и оставляет
-- заявку, а она падает сюда и уходит уведомлением всем super_admin.
--
-- Идемпотентно — можно запускать повторно.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  source       text not null default 'bot',   -- bot | site | manual; payload /start — тоже сюда
  telegram_id  bigint,
  tg_username  text,
  contact_name text,
  venue        text,
  city         text,
  phone        text,
  plan         text check (plan is null or plan in ('start', 'business', 'pro')),
  note         text,
  status       text not null default 'new' check (status in ('new', 'in_progress', 'won', 'lost')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.leads is
  'Заявки на подключение: из Telegram-бота (source=bot) и вручную. Читают только super_admin.';

create index if not exists leads_status_time on public.leads (status, created_at desc);
create index if not exists leads_telegram    on public.leads (telegram_id);

-- ─── RLS: заявки видит и меняет только super_admin ──────────────────────────
-- Бот пишет сюда service-role ключом и RLS не трогает, поэтому политик
-- для вставки из браузера намеренно нет: заявка создаётся только сервером.
alter table public.leads enable row level security;

drop policy if exists "leads_select_super_admin" on public.leads;
create policy "leads_select_super_admin" on public.leads
  for select
  using (public.is_super_admin());

drop policy if exists "leads_write_super_admin" on public.leads;
create policy "leads_write_super_admin" on public.leads
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());
