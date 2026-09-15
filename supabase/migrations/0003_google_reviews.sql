-- ═══════════════════════════════════════════════════════════════════════════
-- Реальные отзывы в Google, а не только переходы.
--
-- Google не сообщает, кто именно оставил отзыв после скана, но через
-- Places API отдаёт по Place ID точное число отзывов, рейтинг и последние
-- отзывы. Раз в сутки cron /api/cron/reviews-sync снимает «снимок» по каждому
-- филиалу; разница между снимками = новые отзывы за период.
--
-- Идемпотентно — можно запускать повторно.
-- ═══════════════════════════════════════════════════════════════════════════

-- Place ID филиала. Заполняется автоматически из ссылки
-- https://search.google.com/local/writereview?placeid=..., иначе руками.
alter table public.branches
  add column if not exists google_place_id text;

comment on column public.branches.google_place_id is
  'Google Place ID (ChIJ…). Нужен для подсчёта реальных отзывов и рейтинга.';

create table if not exists public.review_snapshots (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id) on delete cascade,
  source        text not null default 'google' check (source in ('google')),
  rating        numeric(3,2),
  review_count  integer not null default 0,
  reviews       jsonb,                       -- последние отзывы (до 5), как отдал Google
  captured_at   timestamptz not null default now()
);

create index if not exists review_snapshots_branch_time
  on public.review_snapshots (branch_id, captured_at desc);

alter table public.review_snapshots enable row level security;

drop policy if exists "review_snapshots_select" on public.review_snapshots;
create policy "review_snapshots_select" on public.review_snapshots
  for select to authenticated
  using (
    public.is_super_admin()
    or branch_id = public.current_branch_id()
    or branch_id in (
      select branch_id from public.branch_users where user_id = auth.uid()
    )
    or branch_id in (
      select id from public.branches where company_id = public.current_company_id()
    )
  );
-- Пишет только service_role (cron) — политик на запись нет намеренно.
