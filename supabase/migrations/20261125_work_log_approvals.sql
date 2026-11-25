-- Team weekly timesheet submissions, approval locks, and audit history.
-- Forward-only: do not drop this schema after any time or approval history has been recorded.
begin;

alter table public.work_logs
  add column if not exists team_id uuid,
  add column if not exists work_date date;

update public.work_logs
set work_date = (start_at at time zone 'Asia/Ho_Chi_Minh')::date
where work_date is null;

alter table public.work_logs
  alter column work_date set default current_date,
  alter column work_date set not null;

create index if not exists work_logs_team_user_day_idx
  on public.work_logs (team_id, user_id, work_date);

create table if not exists public.work_log_submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  status text not null check (status in ('submitted','approved','rejected','draft')),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_log_submissions_monday check (extract(isodow from week_start) = 1),
  constraint work_log_submissions_one_per_week unique (team_id, user_id, week_start),
  constraint work_log_submissions_reason_length check (char_length(reject_reason) <= 1000)
);

create index if not exists work_log_submissions_team_week_idx
  on public.work_log_submissions (team_id, week_start, status);

create table if not exists public.work_log_submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.work_log_submissions(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('submitted','approved','rejected','reopened','resubmitted')),
  from_status text,
  to_status text not null,
  reason text not null default '',
  entries_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists work_log_submission_events_submission_idx
  on public.work_log_submission_events (submission_id, created_at desc);

create table if not exists public.work_log_changes (
  id uuid primary key default gen_random_uuid(),
  work_log_id uuid not null,
  team_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('inserted','updated','deleted')),
  before_entry jsonb,
  after_entry jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists work_log_changes_user_team_idx
  on public.work_log_changes (team_id, user_id, changed_at desc);

create or replace function public.is_work_log_team_manager(p_team uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.teams t where t.id = p_team and t.owner = auth.uid())
      or exists (select 1 from public.team_members m where m.team_id = p_team and m.user_id = auth.uid() and m.role in ('owner','admin'));
$$;

revoke all on function public.is_work_log_team_manager(uuid) from public;
grant execute on function public.is_work_log_team_manager(uuid) to authenticated;

-- Let a team manager view a member's records only after a submission exists.
drop policy if exists work_logs_select_submitted_team on public.work_logs;
create policy work_logs_select_submitted_team on public.work_logs
  for select to authenticated
  using (
    team_id is not null
    and public.is_work_log_team_manager(team_id)
    and exists (
      select 1 from public.work_log_submissions s
      where s.team_id = work_logs.team_id and s.user_id = work_logs.user_id
        and s.week_start = date_trunc('week', work_logs.work_date::timestamp)::date
    )
  );

alter table public.work_log_submissions enable row level security;
alter table public.work_log_submission_events enable row level security;
alter table public.work_log_changes enable row level security;

grant select on public.work_log_submissions, public.work_log_submission_events, public.work_log_changes to authenticated;
revoke insert, update, delete on public.work_log_submissions, public.work_log_submission_events, public.work_log_changes from authenticated;

drop policy if exists work_log_submissions_read_participants on public.work_log_submissions;
create policy work_log_submissions_read_participants on public.work_log_submissions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_work_log_team_manager(team_id));

drop policy if exists work_log_submission_events_read_participants on public.work_log_submission_events;
create policy work_log_submission_events_read_participants on public.work_log_submission_events
  for select to authenticated
  using (exists (
    select 1 from public.work_log_submissions s
    where s.id = work_log_submission_events.submission_id
      and (s.user_id = (select auth.uid()) or public.is_work_log_team_manager(s.team_id))
  ));

drop policy if exists work_log_changes_read_participants on public.work_log_changes;
create policy work_log_changes_read_participants on public.work_log_changes
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (team_id is not null
      and public.is_work_log_team_manager(team_id)
      and exists (
        select 1 from public.work_log_submissions s
        where s.team_id = work_log_changes.team_id and s.user_id = work_log_changes.user_id
          and (
            s.week_start = date_trunc('week', (after_entry->>'work_date')::date::timestamp)::date
            or s.week_start = date_trunc('week', (before_entry->>'work_date')::date::timestamp)::date
          )
      )
    )
  );

create or replace function public.guard_work_log_mutation()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
  v_user uuid;
  v_day date;
  v_status text;
  v_old_lock bigint;
  v_new_lock bigint;
begin
  -- Timesheet weeks use the application's Vietnam timezone, independent of DB session timezone.
  if tg_op <> 'DELETE' then
    new.work_date := (new.start_at at time zone 'Asia/Ho_Chi_Minh')::date;
  end if;

  if tg_op <> 'INSERT' then
    if tg_op = 'UPDATE' and old.team_id is distinct from new.team_id then
      raise exception 'A work log cannot be moved between personal and team scopes.' using errcode = '55000';
    end if;
    v_team := old.team_id; v_user := old.user_id; v_day := old.work_date;
    if v_team is not null then
      v_old_lock := hashtextextended(v_team::text || ':' || v_user::text || ':' || date_trunc('week',v_day::timestamp)::date::text,0);
    end if;
  end if;
  if tg_op <> 'DELETE' and new.team_id is not null then
    v_new_lock := hashtextextended(new.team_id::text || ':' || new.user_id::text || ':' || date_trunc('week',new.work_date::timestamp)::date::text,0);
  end if;
  if v_old_lock is not null and v_new_lock is not null and v_old_lock <> v_new_lock then
    if v_old_lock < v_new_lock then
      perform pg_advisory_xact_lock(v_old_lock); perform pg_advisory_xact_lock(v_new_lock);
    else
      perform pg_advisory_xact_lock(v_new_lock); perform pg_advisory_xact_lock(v_old_lock);
    end if;
  elsif v_old_lock is not null then
    perform pg_advisory_xact_lock(v_old_lock);
  elsif v_new_lock is not null then
    perform pg_advisory_xact_lock(v_new_lock);
  end if;

  if tg_op <> 'INSERT' then
    v_team := old.team_id; v_user := old.user_id; v_day := old.work_date;
    if v_team is not null then
      select s.status into v_status from public.work_log_submissions s
      where s.team_id = v_team and s.user_id = v_user
        and s.week_start = date_trunc('week', v_day::timestamp)::date
        and s.status in ('submitted','approved') limit 1;
      if found then raise exception 'Timesheet period is locked (%).', v_status using errcode = '55000'; end if;
    end if;
  end if;

  if tg_op <> 'DELETE' then
    if new.team_id is not null and not (
      exists (select 1 from public.teams t where t.id = new.team_id and t.owner = new.user_id)
      or exists (select 1 from public.team_members m where m.team_id = new.team_id and m.user_id = new.user_id and m.role in ('owner','admin','member'))
    ) then raise exception 'User is not a member of the selected team.' using errcode = '42501'; end if;
    v_team := new.team_id; v_user := new.user_id; v_day := new.work_date;
    if v_team is not null then
      select s.status into v_status from public.work_log_submissions s
      where s.team_id = v_team and s.user_id = v_user
        and s.week_start = date_trunc('week', v_day::timestamp)::date
        and s.status in ('submitted','approved') limit 1;
      if found then raise exception 'Timesheet period is locked (%).', v_status using errcode = '55000'; end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists work_logs_guard_locked_period on public.work_logs;
create trigger work_logs_guard_locked_period
  before insert or update or delete on public.work_logs
  for each row execute function public.guard_work_log_mutation();

create or replace function public.audit_work_log_change()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.work_log_changes(work_log_id,team_id,user_id,actor_id,action,after_entry)
    values(new.id,new.team_id,new.user_id,auth.uid(),'inserted',to_jsonb(new)); return new;
  elsif tg_op = 'UPDATE' then
    insert into public.work_log_changes(work_log_id,team_id,user_id,actor_id,action,before_entry,after_entry)
    values(new.id,new.team_id,new.user_id,auth.uid(),'updated',to_jsonb(old),to_jsonb(new)); return new;
  else
    insert into public.work_log_changes(work_log_id,team_id,user_id,actor_id,action,before_entry)
    values(old.id,old.team_id,old.user_id,auth.uid(),'deleted',to_jsonb(old)); return old;
  end if;
end;
$$;

drop trigger if exists work_logs_audit_changes on public.work_logs;
create trigger work_logs_audit_changes
  after insert or update or delete on public.work_logs
  for each row execute function public.audit_work_log_change();

create or replace function public.submit_work_log_week(p_team uuid, p_week_start date)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_prev text;
  v_snapshot jsonb;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '28000'; end if;
  if p_week_start is null or p_week_start <> date_trunc('week', p_week_start::timestamp)::date then
    raise exception 'Week must start on Monday.' using errcode = '22023';
  end if;
  if not (exists (select 1 from public.teams t where t.id = p_team and t.owner = v_actor)
       or exists (select 1 from public.team_members m where m.team_id = p_team and m.user_id = v_actor and m.role in ('owner','admin','member'))) then
    raise exception 'You are not a member of this team.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_team::text || ':' || v_actor::text || ':' || p_week_start::text,0));
  if exists (select 1 from public.work_logs w where w.team_id=p_team and w.user_id=v_actor and w.work_date>=p_week_start and w.work_date<p_week_start+7 and w.end_at is null) then
    raise exception 'Stop the running timer before submitting this week.' using errcode = '55000';
  end if;
  if not exists (select 1 from public.work_logs w where w.team_id=p_team and w.user_id=v_actor and w.work_date>=p_week_start and w.work_date<p_week_start+7 and w.end_at is not null) then
    raise exception 'There are no completed work logs to submit.' using errcode = '22023';
  end if;

  select id,status into v_id,v_prev from public.work_log_submissions
    where team_id=p_team and user_id=v_actor and week_start=p_week_start for update;
  if v_prev in ('submitted','approved') then raise exception 'This timesheet is already submitted or approved.' using errcode = '55000'; end if;
  select coalesce(jsonb_agg(to_jsonb(w) order by w.start_at),'[]'::jsonb) into v_snapshot
    from public.work_logs w where w.team_id=p_team and w.user_id=v_actor and w.work_date>=p_week_start and w.work_date<p_week_start+7 and w.end_at is not null;

  if v_id is null then
    insert into public.work_log_submissions(team_id,user_id,week_start,status,submitted_at)
      values(p_team,v_actor,p_week_start,'submitted',now()) returning id into v_id;
  else
    update public.work_log_submissions set status='submitted',submitted_at=now(),reviewed_by=null,reviewed_at=null,reject_reason='',updated_at=now() where id=v_id;
  end if;
  insert into public.work_log_submission_events(submission_id,actor_id,action,from_status,to_status,entries_snapshot)
    values(v_id,v_actor,case when v_prev='rejected' then 'resubmitted' else 'submitted' end,v_prev,'submitted',v_snapshot);
  return v_id;
end;
$$;

create or replace function public.review_work_log_submission(p_submission uuid, p_action text, p_reason text default '')
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_sub public.work_log_submissions%rowtype;
  v_next text;
  v_reason text := btrim(coalesce(p_reason,''));
  v_snapshot jsonb;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '28000'; end if;
  select * into v_sub from public.work_log_submissions where id=p_submission for update;
  if not found then raise exception 'Timesheet submission not found.' using errcode = 'P0002'; end if;
  if not public.is_work_log_team_manager(v_sub.team_id) then raise exception 'Only a team owner or admin can review timesheets.' using errcode = '42501'; end if;
  if v_sub.user_id = v_actor then raise exception 'A team manager cannot review their own timesheet.' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('approve','reject','reopen') then raise exception 'Unsupported review action.' using errcode = '22023'; end if;
  if p_action in ('approve','reject') and v_sub.status <> 'submitted' then raise exception 'Only submitted timesheets can be reviewed.' using errcode = '55000'; end if;
  if p_action='reopen' and v_sub.status <> 'approved' then raise exception 'Only approved timesheets can be reopened.' using errcode = '55000'; end if;
  if p_action='reject' and char_length(v_reason) not between 1 and 1000 then raise exception 'A rejection reason is required (max 1000 characters).' using errcode = '22023'; end if;

  v_next := case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'draft' end;
  select coalesce(jsonb_agg(to_jsonb(w) order by w.start_at),'[]'::jsonb) into v_snapshot
    from public.work_logs w where w.team_id=v_sub.team_id and w.user_id=v_sub.user_id and w.work_date>=v_sub.week_start and w.work_date<v_sub.week_start+7;
  update public.work_log_submissions set status=v_next,reviewed_by=v_actor,reviewed_at=now(),reject_reason=case when p_action='reject' then v_reason else '' end,updated_at=now() where id=v_sub.id;
  insert into public.work_log_submission_events(submission_id,actor_id,action,from_status,to_status,reason,entries_snapshot)
    values(v_sub.id,v_actor,case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'reopened' end,v_sub.status,v_next,v_reason,v_snapshot);
end;
$$;

revoke all on function public.submit_work_log_week(uuid, date) from public;
revoke all on function public.review_work_log_submission(uuid, text, text) from public;
grant execute on function public.submit_work_log_week(uuid, date) to authenticated;
grant execute on function public.review_work_log_submission(uuid, text, text) to authenticated;

commit;
