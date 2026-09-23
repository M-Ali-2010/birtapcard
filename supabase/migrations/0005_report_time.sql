-- ═══════════════════════════════════════════════════════════════════════════
-- Время ежедневного отчёта — своё для каждой компании.
--
-- Раньше отчёт уходил всем в один фиксированный час, зашитый в расписание
-- крона. Ресторану удобно получать сводку утром до открытия, клинике —
-- вечером после смены. Теперь час хранится рядом с настройками Telegram,
-- а last_report_at страхует от двойной отправки, если крон сработает дважды.
--
-- Идемпотентно — можно запускать повторно.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.telegram_settings
  add column if not exists report_hour smallint not null default 8,
  add column if not exists last_report_at timestamptz;

comment on column public.telegram_settings.report_hour is
  'Час отправки ежедневного отчёта по ташкентскому времени (0–23). По умолчанию 8 утра.';

comment on column public.telegram_settings.last_report_at is
  'Когда отчёт реально ушёл в последний раз. Защита от повторной отправки за те же сутки.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'telegram_settings_report_hour_check'
  ) then
    alter table public.telegram_settings
      add constraint telegram_settings_report_hour_check
      check (report_hour between 0 and 23);
  end if;
end $$;
