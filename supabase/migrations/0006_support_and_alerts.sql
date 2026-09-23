-- ═══════════════════════════════════════════════════════════════════════════
-- Поддержка прямо в боте и уведомления о новых отзывах Google.
--
-- Раздел «Поддержка» до этого был заглушкой «скоро», а про новый отзыв
-- владелец узнавал только из утренней сводки — то есть спустя сутки.
-- Теперь: переписка с поддержкой живёт в support_messages (клиент пишет,
-- админ отвечает из своего чата), а отзыв прилетает в момент появления.
--
-- Идемпотентно — можно запускать повторно.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.support_messages (
  id                 uuid primary key default gen_random_uuid(),
  telegram_id        bigint not null,
  tg_username        text,
  user_id            uuid,
  company_id         uuid references public.companies(id) on delete set null,
  text               text not null,
  status             text not null default 'new' check (status in ('new', 'answered')),
  answer             text,
  admin_telegram_id  bigint,
  created_at         timestamptz not null default now(),
  answered_at        timestamptz
);

comment on table public.support_messages is
  'Обращения в поддержку из Telegram-бота и ответы администраторов.';

create index if not exists support_status_time on public.support_messages (status, created_at desc);

alter table public.support_messages enable row level security;

drop policy if exists "support_select_super_admin" on public.support_messages;
create policy "support_select_super_admin" on public.support_messages
  for select using (public.is_super_admin());

drop policy if exists "support_write_super_admin" on public.support_messages;
create policy "support_write_super_admin" on public.support_messages
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ─── Мгновенные уведомления о новых отзывах Google ──────────────────────────
alter table public.telegram_settings
  add column if not exists notify_reviews boolean not null default true;

comment on column public.telegram_settings.notify_reviews is
  'Присылать сообщение сразу, как только у филиала появились новые отзывы Google.';
