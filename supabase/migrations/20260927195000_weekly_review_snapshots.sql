-- Weekly reviews are immutable snapshots. Older rows keep null period fields
-- and remain readable through the same paginated history function.
alter table public.reviews
  add column period_start date,
  add column period_end_exclusive date,
  add column workspace_timezone text,
  add column revision integer not null default 1,
  add column idempotency_key uuid,
  add column snapshot jsonb;

alter table public.reviews
  add constraint reviews_period_bounds_check
    check ((period_start is null and period_end_exclusive is null) or
      (period_start is not null and period_end_exclusive is not null and period_end_exclusive = period_start + 7)),
  add constraint reviews_period_timezone_check
    check (period_start is null or (workspace_timezone is not null and type = 'weekly')),
  add constraint reviews_revision_positive_check check (revision > 0),
  add constraint reviews_snapshot_object_check
    check (snapshot is null or jsonb_typeof(snapshot) = 'object');

create unique index reviews_week_revision_unique
  on public.reviews (workspace_id, period_start, revision)
  where period_start is not null;
create unique index reviews_idempotency_key_unique
  on public.reviews (workspace_id, idempotency_key)
  where idempotency_key is not null;
create index reviews_period_history_idx
  on public.reviews (workspace_id, period_start desc, revision desc)
  where period_start is not null;

create function public.complete_weekly_review_v3(
  target_workspace_id uuid,
  target_review_id uuid,
  review_summary text,
  review_answers jsonb,
  selected_goal_ids uuid[],
  period_start date,
  period_end_exclusive date,
  review_timezone text,
  review_snapshot jsonb,
  command_idempotency_key uuid
)
returns public.reviews
language plpgsql
security invoker
set search_path = ''
as $$
declare
  review_record public.reviews;
  workspace_timezone text;
  next_revision integer;
begin
  if not private.is_workspace_member(target_workspace_id) then
    raise exception 'workspace_access_denied' using errcode = '42501';
  end if;

  if target_review_id is null or command_idempotency_key is null then
    raise exception 'review_idempotency_key_required';
  end if;

  -- A retry must return its original snapshot even if mutable Workspace data
  -- changed after the first request committed.
  select * into review_record from public.reviews
  where workspace_id = target_workspace_id and idempotency_key = command_idempotency_key
  limit 1;
  if found then return review_record; end if;

  select timezone into workspace_timezone
  from public.workspaces
  where id = target_workspace_id;
  if workspace_timezone is null or review_timezone is distinct from workspace_timezone then
    raise exception 'review_timezone_mismatch';
  end if;
  if review_answers is null or jsonb_typeof(review_answers) <> 'object' then
    raise exception 'invalid_review_answers';
  end if;
  if review_snapshot is null or jsonb_typeof(review_snapshot) <> 'object' then
    raise exception 'invalid_review_snapshot';
  end if;
  if period_start is null or period_end_exclusive <> period_start + 7 then
    raise exception 'invalid_review_period';
  end if;
  if review_snapshot #>> '{period,startDate}' is distinct from period_start::text or
     review_snapshot #>> '{period,endDateExclusive}' is distinct from period_end_exclusive::text or
     review_snapshot #>> '{period,timeZone}' is distinct from workspace_timezone then
    raise exception 'review_snapshot_period_mismatch';
  end if;
  if selected_goal_ids is null or cardinality(selected_goal_ids) > 3 or
     (select count(distinct selected.goal_id) from unnest(selected_goal_ids) as selected(goal_id)) <> cardinality(selected_goal_ids) then
    raise exception 'invalid_selected_goals';
  end if;
  if exists (
    select 1 from unnest(selected_goal_ids) as selected(goal_id)
    left join public.goals goal on goal.id = selected.goal_id
      and goal.workspace_id = target_workspace_id
      and goal.status = 'active'
      and goal.archived_at is null and goal.trashed_at is null
    where goal.id is null
  ) then
    raise exception 'selected_goal_not_active';
  end if;

  -- Serialize concurrent saves for this Workspace week so each intentional
  -- save gets one stable, monotonically increasing revision.
  perform pg_advisory_xact_lock(hashtextextended(target_workspace_id::text || ':' || period_start::text, 0));
  select * into review_record from public.reviews
  where workspace_id = target_workspace_id and idempotency_key = command_idempotency_key
  limit 1;
  if found then return review_record; end if;

  select coalesce(max(revision), 0) + 1 into next_revision
  from public.reviews
  where workspace_id = target_workspace_id and public.reviews.period_start = complete_weekly_review_v3.period_start;

  begin
    insert into public.reviews (
      id, workspace_id, type, template_version, answers, summary, command_ids,
      completed_by, period_start, period_end_exclusive, workspace_timezone,
      revision, idempotency_key, snapshot
    ) values (
      target_review_id, target_workspace_id, 'weekly', 3,
      (review_answers - 'selectedGoalIds') || jsonb_build_object('selectedGoalIds', to_jsonb(coalesce(selected_goal_ids, '{}'::uuid[]))),
      btrim(review_summary), array[command_idempotency_key], (select auth.uid()),
      period_start, period_end_exclusive, workspace_timezone,
      next_revision, command_idempotency_key, review_snapshot
    ) returning * into review_record;
  exception when unique_violation then
    select * into review_record from public.reviews
    where workspace_id = target_workspace_id and idempotency_key = command_idempotency_key
    limit 1;
    if found then return review_record; end if;
    raise;
  end;

  perform private.append_activity_event(
    target_workspace_id, (select auth.uid()), 'user', 'complete_weekly_review_v3', selected_goal_ids,
    jsonb_build_object('reviewId', review_record.id, 'revision', review_record.revision, 'periodStart', period_start),
    command_idempotency_key
  );
  return review_record;
end;
$$;

revoke all on function public.complete_weekly_review_v3(uuid, uuid, text, jsonb, uuid[], date, date, text, jsonb, uuid) from public, anon;
grant execute on function public.complete_weekly_review_v3(uuid, uuid, text, jsonb, uuid[], date, date, text, jsonb, uuid) to authenticated;

create or replace function public.get_reviews_page(target_workspace_id uuid, page_size integer default 20, cursor_sort_value text default null, cursor_id uuid default null)
returns jsonb language sql stable security invoker as $$
with ranked as (
  select review.*, row_number() over (order by review.completed_at, review.id) as row_no
  from public.reviews review
  where review.workspace_id = target_workspace_id and private.is_workspace_member(review.workspace_id)
    and (cursor_sort_value is null or (review.completed_at::text, review.id::text) > (cursor_sort_value, cursor_id::text))
  order by review.completed_at, review.id
  limit greatest(1, least(coalesce(page_size, 20), 100)) + 1
), visible as (select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 20), 100)))
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(jsonb_build_object(
    'id', review.id, 'type', review.type, 'templateVersion', review.template_version,
    'answers', review.answers, 'summary', review.summary, 'completedAt', review.completed_at,
    'periodStart', review.period_start, 'periodEndExclusive', review.period_end_exclusive,
    'workspaceTimezone', review.workspace_timezone, 'revision', review.revision, 'snapshot', review.snapshot
  ) order by review.completed_at, review.id) from visible review), '[]'::jsonb),
  'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 20), 100)) + 1)
    then (select jsonb_build_object('sortValue', review.completed_at::text, 'id', review.id) from visible review order by review.completed_at desc, review.id desc limit 1)
    else null end
);
$$;
