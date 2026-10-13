-- ════════════════════════════════════════════════════════════════════════════
-- Ссылки экрана заведения, которые администратор меняет прямо в боте.
--
-- Экран PDP (бот, канал, Instagram, сайт, отзыв, приложения) брал адреса из кода.
-- Теперь у заведения может быть своя ссылка по каждому пункту: заведение в боте →
-- «🔗 Ссылки экрана» → пункт → новая ссылка. Нет записи — экран показывает значение
-- по умолчанию; запись важнее значений филиала из кабинета.
--
-- RLS включён и политик нет намеренно: читает и пишет только сервер (service_role).
-- Идемпотентно — можно запускать повторно.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.venue_links (
  company_id uuid not null references public.companies(id) on delete cascade,
  key        text not null check (key in ('review', 'website', 'bot', 'channel', 'instagram', 'play', 'ios')),
  url        text not null check (length(url) between 8 and 500),
  updated_by bigint,
  updated_at timestamptz not null default now(),
  primary key (company_id, key)
);

alter table public.venue_links enable row level security;
