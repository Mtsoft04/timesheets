-- Personal time tracking: append this migration in Supabase SQL Editor.
begin;

create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid,
  task_title text not null check (char_length(btrim(task_title)) between 1 and 200),
  note text not null default '' check (char_length(note) <= 1000),
  start_at timestamptz not null default now(),
  end_at timestamptz,
  created_at timestamptz not null default now(),
  constraint work_logs_time_order check (end_at is null or end_at > start_at)
);

create index if not exists work_logs_user_start_idx
  on public.work_logs (user_id, start_at desc);

-- A user can have only one running timer at a time, including concurrent tabs.
create unique index if not exists work_logs_one_active_per_user_idx
  on public.work_logs (user_id)
  where end_at is null;

alter table public.work_logs enable row level security;

grant select, insert, update, delete on public.work_logs to authenticated;

drop policy if exists work_logs_select_own on public.work_logs;
create policy work_logs_select_own on public.work_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists work_logs_insert_own on public.work_logs;
create policy work_logs_insert_own on public.work_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists work_logs_update_own on public.work_logs;
create policy work_logs_update_own on public.work_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists work_logs_delete_own on public.work_logs;
create policy work_logs_delete_own on public.work_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.work_logs is
  'Personal work-time entries and active timer sessions, scoped to the owning Supabase Auth user.';

commit;
