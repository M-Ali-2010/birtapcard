-- ════════════════════════════════════════════════════════════════════════════
-- Wi-Fi заведения: карточка «Wi-Fi» на экране после скана (сейчас — у PDP School).
--
-- Раньше название сети и пароль брались из переменных окружения Vercel: менять
-- их приходилось в панели Vercel и с передеплоем. Теперь администратор вводит
-- их в боте (карточка заведения → «📶 Wi-Fi на карточке»), и экран подхватывает
-- значения сразу, без деплоя.
--
-- Пароль не лежит в репозитории и не показывается в отчётах бота.
-- RLS включён и политик нет намеренно: читает и пишет только сервер (service_role).
-- Идемпотентно — можно запускать повторно.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.venue_wifi (
  company_id uuid primary key references public.companies(id) on delete cascade,
  ssid       text not null check (length(btrim(ssid)) between 1 and 64),
  password   text check (password is null or length(password) <= 128),
  updated_by bigint,
  updated_at timestamptz not null default now()
);

alter table public.venue_wifi enable row level security;
