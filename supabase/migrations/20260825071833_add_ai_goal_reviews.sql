-- Read-only AI portfolio review. Provider calls and privileged writes happen in
-- the authenticated Edge Function; browser access remains read-only under RLS.
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (capability = 'goal_portfolio_review'),
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  model text not null check (char_length(btrim(model)) between 1 and 200),
  prompt_version integer not null check (prompt_version > 0),
  schema_version integer not null check (schema_version > 0),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  input_chars integer not null default 0 check (input_chars >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  provider_request_id text,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (id, workspace_id)
);

create table public.ai_goal_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  run_id uuid,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  source_snapshot_at timestamptz not null,
  context_hash text not null check (char_length(context_hash) = 64),
  prompt_version integer not null check (prompt_version > 0),
  schema_version integer not null check (schema_version > 0),
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  model text not null check (char_length(btrim(model)) between 1 and 200),
  review_json jsonb not null check (jsonb_typeof(review_json) = 'object'),
  analyzed_goal_ids uuid[] not null default '{}',
  omitted_goal_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  cache_expires_at timestamptz not null,
  unique (id, workspace_id),
  foreign key (run_id, workspace_id) references public.ai_runs(id, workspace_id) on delete set null (run_id)
);

create table public.ai_goal_review_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id text,
  rating text not null check (rating in ('helpful', 'not_helpful')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (review_id, workspace_id) references public.ai_goal_reviews(id, workspace_id) on delete cascade,
  check (recommendation_id is null or char_length(recommendation_id) between 1 and 80)
);

create unique index ai_goal_review_feedback_review_unique
  on public.ai_goal_review_feedback (review_id, user_id)
  where recommendation_id is null;
create unique index ai_goal_review_feedback_recommendation_unique
  on public.ai_goal_review_feedback (review_id, user_id, recommendation_id)
  where recommendation_id is not null;
create index ai_runs_workspace_user_time_idx on public.ai_runs (workspace_id, user_id, created_at desc);
create index ai_goal_reviews_workspace_time_idx on public.ai_goal_reviews (workspace_id, created_at desc);
create index ai_goal_reviews_context_idx on public.ai_goal_reviews (workspace_id, context_hash, prompt_version, model, created_at desc);

alter table public.ai_runs enable row level security;
alter table public.ai_goal_reviews enable row level security;
alter table public.ai_goal_review_feedback enable row level security;

create policy "members read ai runs" on public.ai_runs for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "members read ai goal reviews" on public.ai_goal_reviews for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "members read own ai feedback" on public.ai_goal_review_feedback for select to authenticated
  using (user_id = (select auth.uid()) and private.is_workspace_member(workspace_id));

revoke all on table public.ai_runs, public.ai_goal_reviews, public.ai_goal_review_feedback from public, anon, authenticated;
grant select on table public.ai_runs, public.ai_goal_reviews, public.ai_goal_review_feedback to authenticated;
grant all on table public.ai_runs, public.ai_goal_reviews, public.ai_goal_review_feedback to service_role;

create or replace function public.get_ai_goal_review_context(target_workspace_id uuid, window_days integer default 28)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with settings as (
  select greatest(1, least(window_days, 90)) as days, now() as snapshot_at
), eligible_goals as (
  select goal.*,
    row_number() over (order by
      case goal.priority when 'high' then 0 when 'normal' then 1 else 2 end,
      goal.target_date nulls last, goal.updated_at desc, goal.id) as row_number
  from public.goals goal
  where goal.workspace_id = target_workspace_id
    and goal.status = 'active' and goal.archived_at is null and goal.trashed_at is null
), selected_goals as (
  select * from eligible_goals where row_number <= 50
), goal_context as (
  select goal.id,
    jsonb_build_object(
      'id', goal.id, 'title', goal.title, 'outcome', goal.outcome, 'kind', goal.kind,
      'priority', goal.priority, 'targetDate', goal.target_date,
      'area', case when area.id is null then null else jsonb_build_object('id', area.id, 'name', area.name) end,
      'criteria', coalesce((select jsonb_agg(jsonb_build_object('id', criterion.id, 'title', criterion.title, 'completed', criterion.completed) order by criterion.position, criterion.id) from public.goal_criteria criterion where criterion.workspace_id = target_workspace_id and criterion.goal_id = goal.id), '[]'::jsonb),
      'openActions', coalesce((select jsonb_agg(jsonb_build_object('id', action.id, 'title', action.title, 'status', action.status, 'scheduledFor', action.scheduled_for, 'isNext', action.is_next, 'blocker', action.blocker) order by action.position, action.id) from public.actions action where action.workspace_id = target_workspace_id and action.goal_id = goal.id and action.archived_at is null and action.trashed_at is null and action.status not in ('completed', 'skipped', 'cancelled')), '[]'::jsonb),
      'completed7Days', (select count(*) from public.actions action, settings where action.workspace_id = target_workspace_id and action.goal_id = goal.id and action.status = 'completed' and action.completed_at >= settings.snapshot_at - interval '7 days'),
      'completed28Days', (select count(*) from public.actions action, settings where action.workspace_id = target_workspace_id and action.goal_id = goal.id and action.status = 'completed' and action.completed_at >= settings.snapshot_at - make_interval(days => settings.days)),
      'recentProgress', coalesce((select jsonb_agg(entry.payload order by entry.created_at desc) from (select progress.created_at, jsonb_build_object('kind', progress.kind, 'content', left(progress.content, 500), 'createdAt', progress.created_at) as payload from public.progress_entries progress where progress.workspace_id = target_workspace_id and progress.goal_id = goal.id order by progress.created_at desc limit 5) entry), '[]'::jsonb),
      'lastActivityAt', greatest(goal.updated_at, coalesce((select max(action.updated_at) from public.actions action where action.workspace_id = target_workspace_id and action.goal_id = goal.id), goal.updated_at), coalesce((select max(progress.created_at) from public.progress_entries progress where progress.workspace_id = target_workspace_id and progress.goal_id = goal.id), goal.updated_at)),
      'signals', (select coalesce(jsonb_agg(signal order by signal->>'signalKey'), '[]'::jsonb) from (
        select jsonb_build_object('signalKey', 'goal:' || goal.id || ':missing-next-action', 'kind', 'missing_next_action', 'label', 'brak następnego Działania') as signal where not exists (select 1 from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id and a.is_next and a.status in ('ready', 'in_progress') and a.archived_at is null and a.trashed_at is null)
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':missing-criteria', 'kind', 'missing_criteria', 'label', 'brak kryteriów sukcesu') where not exists (select 1 from public.goal_criteria c where c.workspace_id = target_workspace_id and c.goal_id = goal.id)
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':blocked:' || count(*), 'kind', 'blocked_actions', 'label', count(*) || ' blokad') from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id and a.status = 'blocked' and a.archived_at is null and a.trashed_at is null having count(*) > 0
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':overdue-actions:' || count(*), 'kind', 'overdue_actions', 'label', count(*) || ' zaległych Działań') from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id and a.status not in ('completed', 'skipped', 'cancelled') and a.scheduled_for < current_date and a.archived_at is null and a.trashed_at is null having count(*) > 0
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':overdue-goal', 'kind', 'overdue_goal', 'label', 'przekroczony termin Celu') where goal.target_date < current_date
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':due-soon', 'kind', 'due_soon', 'label', 'termin Celu w ciągu 7 dni') where goal.target_date between current_date and current_date + 7
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':inactive:' || inactivity.days, 'kind', 'inactive', 'label', 'brak aktywności od ' || inactivity.days || ' dni') from (select case when greatest(goal.updated_at, coalesce((select max(a.updated_at) from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id), goal.updated_at), coalesce((select max(p.created_at) from public.progress_entries p where p.workspace_id = target_workspace_id and p.goal_id = goal.id), goal.updated_at)) < now() - interval '30 days' then 30 when greatest(goal.updated_at, coalesce((select max(a.updated_at) from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id), goal.updated_at), coalesce((select max(p.created_at) from public.progress_entries p where p.workspace_id = target_workspace_id and p.goal_id = goal.id), goal.updated_at)) < now() - interval '14 days' then 14 when greatest(goal.updated_at, coalesce((select max(a.updated_at) from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id), goal.updated_at), coalesce((select max(p.created_at) from public.progress_entries p where p.workspace_id = target_workspace_id and p.goal_id = goal.id), goal.updated_at)) < now() - interval '7 days' then 7 end as days) inactivity where inactivity.days is not null
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':too-many-open-actions:' || count(*), 'kind', 'too_many_open_actions', 'label', count(*) || ' równoległych Działań') from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id and a.status not in ('completed', 'skipped', 'cancelled') and a.archived_at is null and a.trashed_at is null having count(*) > 5
      ) signals)
    ) as payload
  from selected_goals goal
  left join public.areas area on area.id = goal.area_id and area.workspace_id = goal.workspace_id
)
select case when not private.is_workspace_member(target_workspace_id) then null else jsonb_build_object(
  'workspaceId', target_workspace_id,
  'sourceSnapshotAt', settings.snapshot_at,
  'periodStart', (settings.snapshot_at::date - settings.days),
  'periodEnd', settings.snapshot_at::date,
  'goals', coalesce((select jsonb_agg(goal_context.payload order by selected_goals.row_number) from goal_context join selected_goals using (id)), '[]'::jsonb),
  'omittedGoalIds', coalesce((select jsonb_agg(id order by row_number) from eligible_goals where row_number > 50), '[]'::jsonb)
) end
from settings;
$$;

revoke all on function public.get_ai_goal_review_context(uuid, integer) from public, anon;
grant execute on function public.get_ai_goal_review_context(uuid, integer) to authenticated, service_role;

create or replace function private.set_ai_goal_review_feedback(
  target_workspace_id uuid,
  target_review_id uuid,
  target_recommendation_id text,
  target_rating text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null or not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_not_available' using errcode = '42501'; end if;
  if target_rating not in ('helpful', 'not_helpful') then raise exception 'invalid_rating' using errcode = '22023'; end if;
  if not exists (select 1 from public.ai_goal_reviews review where review.id = target_review_id and review.workspace_id = target_workspace_id) then raise exception 'workspace_not_available' using errcode = '42501'; end if;
  if target_recommendation_id is not null and not exists (
    select 1 from public.ai_goal_reviews review,
      jsonb_array_elements(review.review_json->'recommendations') recommendation
    where review.id = target_review_id and review.workspace_id = target_workspace_id
      and recommendation->>'id' = target_recommendation_id
  ) then raise exception 'recommendation_not_available' using errcode = '22023'; end if;

  if target_recommendation_id is null then
    insert into public.ai_goal_review_feedback (workspace_id, review_id, user_id, recommendation_id, rating)
    values (target_workspace_id, target_review_id, caller, null, target_rating)
    on conflict (review_id, user_id) where recommendation_id is null do update set rating = excluded.rating, updated_at = now();
  else
    insert into public.ai_goal_review_feedback (workspace_id, review_id, user_id, recommendation_id, rating)
    values (target_workspace_id, target_review_id, caller, target_recommendation_id, target_rating)
    on conflict (review_id, user_id, recommendation_id) where recommendation_id is not null do update set rating = excluded.rating, updated_at = now();
  end if;
end;
$$;

revoke all on function private.set_ai_goal_review_feedback(uuid, uuid, text, text) from public, anon;
grant execute on function private.set_ai_goal_review_feedback(uuid, uuid, text, text) to authenticated;

create or replace function public.set_ai_goal_review_feedback(
  target_workspace_id uuid,
  target_review_id uuid,
  target_recommendation_id text,
  target_rating text
) returns void
language sql
volatile
security invoker
set search_path = ''
as $$ select private.set_ai_goal_review_feedback(target_workspace_id, target_review_id, target_recommendation_id, target_rating); $$;

revoke all on function public.set_ai_goal_review_feedback(uuid, uuid, text, text) from public, anon;
grant execute on function public.set_ai_goal_review_feedback(uuid, uuid, text, text) to authenticated;
