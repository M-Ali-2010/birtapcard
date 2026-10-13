-- ════════════════════════════════════════════════════════════════════════════
-- Клиенты, которые работают только через Telegram-бота.
--
-- Раньше, чтобы владелец увидел отчёты в боте, ему нужна была учётная запись
-- в кабинете и ссылка привязки из него. Теперь администратор в боте нажимает
-- «Пригласить владельца» на карточке заведения и пересылает ссылку — человек
-- открывает бота и сразу видит свои цифры. Ни сайт, ни приложение не нужны.
--
--   bot_invites — одноразовые приглашения (код из ссылки t.me/<бот>?start=inv_<код>)
--   bot_clients — подключённые так люди: чей Telegram к какому заведению привязан
--
-- RLS включён и политик нет намеренно: читает и пишет только бот через service_role.
-- Идемпотентно — можно запускать повторно.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.bot_invites (
  code        text primary key,
  company_id  uuid not null references public.companies(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'branch_manager')),
  created_by  bigint,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  used_by     bigint,
  used_at     timestamptz
);

create table if not exists public.bot_clients (
  telegram_id bigint primary key,
  company_id  uuid not null references public.companies(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'branch_manager')),
  full_name   text,
  username    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists bot_clients_company on public.bot_clients (company_id);

alter table public.bot_invites enable row level security;
alter table public.bot_clients enable row level security;
