-- ════════════════════════════════════════════════════════════════════════════
-- Новые цели нажатий: экран PDP School.
--
-- На экране PDP School (lib/screens/pdp-school.ts) кроме Google, Telegram и бота
-- есть сайт, Google Play, App Store и Wi-Fi. Чтобы их нажатия попадали в
-- link_clicks, список допустимых значений target расширяется.
--
-- Если на колонке target стоял CHECK на прежние шесть целей, вставка новых
-- отклонялась (в логе появлялась ошибка, гость её не видел) — теперь пропускается.
-- Старые ограничения на target снимаются, затем ставится одно общее.
-- NOT VALID — существующие строки не перепроверяются, это не нужно и не блокирует таблицу.
--
-- Идемпотентно — можно запускать повторно.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.link_clicks'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%target%'
  loop
    execute format('alter table public.link_clicks drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.link_clicks
  add constraint link_clicks_target_check
  check (target in (
    'google', 'yandex', 'gis', 'instagram', 'telegram', 'bot',
    'website', 'google_play', 'app_store', 'wifi'
  )) not valid;
