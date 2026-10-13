-- ════════════════════════════════════════════════════════════════════════════
-- Новые цели нажатий: экран PDP School.
--
-- На экране PDP School (lib/screens/pdp-school.ts) кроме Google и бота есть сайт,
-- Google Play, App Store и Wi-Fi. Чтобы их нажатия попадали в link_clicks,
-- колонка target должна принимать четыре новых значения:
--   website, google_play, app_store, wifi.
--
-- Скрипт ничего не ломает и подстраивается под то, как устроена колонка:
--   · стоит CHECK на target   → он снимается и ставится заново с полным списком;
--   · target — enum           → в него добавляются недостающие значения;
--   · ограничений нет         → ничего не меняется (вставка и так работает).
-- Существующие строки не трогаются и не перепроверяются.
--
-- Идемпотентно — можно запускать повторно.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  c        record;
  dropped  boolean := false;
  col_type text;
  col_udt  text;
  v        text;
begin
  -- 1. Прежние CHECK на target (на шесть старых целей) — снимаем
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.link_clicks'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%target%'
  loop
    execute format('alter table public.link_clicks drop constraint %I', c.conname);
    dropped := true;
  end loop;

  select data_type, udt_name
    into col_type, col_udt
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'link_clicks'
     and column_name  = 'target';

  if col_type = 'USER-DEFINED' then
    -- 2. target — enum: добавляем недостающие значения
    foreach v in array array['website', 'google_play', 'app_store', 'wifi'] loop
      execute format('alter type public.%I add value if not exists %L', col_udt, v);
    end loop;
  elsif dropped then
    -- 3. CHECK был — возвращаем его, уже с новыми целями (NOT VALID: старые строки не сканируются)
    alter table public.link_clicks
      add constraint link_clicks_target_check
      check (target in (
        'google', 'yandex', 'gis', 'instagram', 'telegram', 'bot',
        'website', 'google_play', 'app_store', 'wifi'
      )) not valid;
  end if;
end $$;
