-- A weekly review records the chosen direction; Action dates remain the live agenda.
create function public.complete_weekly_review_v2(
  target_workspace_id uuid,
  review_summary text,
  review_answers jsonb,
  selected_goal_ids uuid[],
  command_idempotency_key uuid
)
returns public.reviews
language plpgsql
security invoker
set search_path = ''
as $$
declare review_record public.reviews;
begin
  select * into review_record from public.reviews
  where workspace_id = target_workspace_id and command_ids @> array[command_idempotency_key] limit 1;
  if found then return review_record; end if;

  if review_answers is null or jsonb_typeof(review_answers) <> 'object' then
    raise exception 'invalid_review_answers';
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

  insert into public.reviews (workspace_id, type, template_version, answers, summary, command_ids, completed_by)
  values (
    target_workspace_id, 'weekly', 2,
    (review_answers - 'selectedGoalIds') || jsonb_build_object('selectedGoalIds', to_jsonb(coalesce(selected_goal_ids, '{}'::uuid[]))),
    btrim(review_summary), array[command_idempotency_key], (select auth.uid())
  ) returning * into review_record;
  perform private.append_activity_event(
    target_workspace_id, (select auth.uid()), 'user', 'complete_weekly_review_v2', selected_goal_ids,
    jsonb_build_object('reviewId', review_record.id, 'selectedGoalCount', cardinality(selected_goal_ids)), command_idempotency_key
  );
  return review_record;
end;
$$;

revoke all on function public.complete_weekly_review_v2(uuid, text, jsonb, uuid[], uuid) from public, anon;
grant execute on function public.complete_weekly_review_v2(uuid, text, jsonb, uuid[], uuid) to authenticated;

-- A blocked action has its own follow-up date, independent of its scheduled work date.
alter table public.actions add column review_on date;
create index actions_waiting_review_idx on public.actions(workspace_id, review_on, id)
  where status = 'blocked' and review_on is not null and archived_at is null and trashed_at is null;

-- Older clients can still change status through the original command. Clear a
-- follow-up date whenever they unblock an action.
create function private.clear_action_review_on()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status <> 'blocked' then new.review_on := null; end if;
  return new;
end;
$$;
create trigger clear_action_review_on before insert or update of status, review_on on public.actions
for each row execute function private.clear_action_review_on();
revoke all on function private.clear_action_review_on() from public, anon, authenticated;

create function public.set_action_status_review_checked(
  target_action_id uuid,
  expected_version integer,
  target_status text,
  target_blocker text,
  target_review_on date,
  command_idempotency_key uuid
)
returns public.actions
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.actions;
declare previous_status text;
declare previous_blocker text;
begin
  if target_status not in ('ready', 'in_progress', 'testing', 'blocked', 'completed', 'skipped', 'cancelled') then
    raise exception 'invalid_action_status';
  end if;
  if target_status = 'blocked' and btrim(coalesce(target_blocker, '')) = '' then
    raise exception 'action_blocker_required';
  end if;
  if target_status <> 'blocked' and target_review_on is not null then
    raise exception 'review_date_requires_blocker';
  end if;
  select * into item from public.actions where id = target_action_id for update;
  if not found then raise exception 'action_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  if item.version <> expected_version then raise exception 'action_version_conflict'; end if;
  if item.status = target_status and (target_status <> 'blocked' or
    (item.blocker = btrim(target_blocker) and item.review_on is not distinct from target_review_on)) then return item; end if;

  previous_status := item.status;
  previous_blocker := item.blocker;
  update public.actions set
    status = target_status,
    blocker = case when target_status = 'blocked' then btrim(target_blocker) else null end,
    review_on = case when target_status = 'blocked' then target_review_on else null end,
    completed_at = case when target_status = 'completed' then now() else null end,
    skipped_at = case when target_status = 'skipped' then now() else null end,
    cancelled_at = case when target_status = 'cancelled' then now() else null end,
    is_next = case when target_status in ('ready', 'in_progress') then is_next else false end,
    updated_at = now(), version = version + 1
  where id = item.id returning * into item;

  if item.goal_id is not null and
    (previous_status <> target_status or previous_blocker is distinct from item.blocker) and
    (target_status = 'blocked' or previous_status = 'blocked') then
    insert into public.progress_entries (id, workspace_id, goal_id, action_id, kind, content)
    values (command_idempotency_key, item.workspace_id, item.goal_id, item.id, 'blocker',
      case when target_status = 'blocked' then 'Zablokowano: ' || btrim(target_blocker)
        else 'Odblokowano. Poprzedni powód: ' || coalesce(previous_blocker, 'brak') end)
    on conflict (id) do nothing;
  end if;
  perform private.append_activity_event(
    item.workspace_id, (select auth.uid()), 'user', 'set_action_status_review_checked', array[item.id],
    jsonb_build_object('from', previous_status, 'to', target_status, 'reviewOn', target_review_on), command_idempotency_key
  );
  return item;
end;
$$;
revoke all on function public.set_action_status_review_checked(uuid, integer, text, text, date, uuid) from public, anon;
grant execute on function public.set_action_status_review_checked(uuid, integer, text, text, date, uuid) to authenticated;

create function public.get_waiting_actions_page(
  target_workspace_id uuid,
  target_view text default 'waiting',
  target_project_id uuid default null,
  target_goal_id uuid default null,
  target_today date default null,
  page_size integer default 30,
  cursor_sort_value text default null,
  cursor_id uuid default null
)
returns jsonb language sql stable security invoker set search_path = '' as $$
with workspace_context as (
  select w.id, coalesce(target_today, (now() at time zone w.timezone)::date) as today
  from public.workspaces w
  where w.id = target_workspace_id and private.is_workspace_member(w.id)
), candidates as (
  select action.*, goal.area_id as goal_area_id, action.review_on::text as sort_value
  from public.actions action
  join workspace_context workspace on workspace.id = action.workspace_id
  left join public.goals goal on goal.id = action.goal_id and goal.workspace_id = action.workspace_id
  left join public.areas action_project on action_project.id = action.area_id and action_project.workspace_id = action.workspace_id
  left join public.areas goal_project on goal_project.id = goal.area_id and goal_project.workspace_id = action.workspace_id
  where target_view = 'waiting'
    and action.workspace_id = target_workspace_id
    and action.status = 'blocked' and action.review_on <= workspace.today
    and action.archived_at is null and action.trashed_at is null
    and (action.goal_id is null or (goal.id is not null and goal.archived_at is null and goal.trashed_at is null))
    and (action.area_id is null or (action_project.id is not null and action_project.archived_at is null and action_project.trashed_at is null))
    and (goal.area_id is null or (goal_project.id is not null and goal_project.archived_at is null and goal_project.trashed_at is null))
    and (target_goal_id is null or action.goal_id = target_goal_id)
    and (target_project_id is null or action.area_id = target_project_id or goal.area_id = target_project_id)
    and (cursor_sort_value is null or (action.review_on::text, action.id::text) > (cursor_sort_value, cursor_id::text))
), ranked as (
  select candidates.*, row_number() over (order by sort_value, id) as row_no
  from candidates
  order by sort_value, id
  limit greatest(1, least(coalesce(page_size, 30), 100)) + 1
), visible as (
  select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 30), 100))
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(jsonb_build_object(
    'id', item.id, 'version', item.version, 'goalId', item.goal_id, 'areaId', item.area_id,
    'title', item.title, 'detail', item.detail, 'status', item.status, 'blocker', item.blocker,
    'reviewOn', item.review_on, 'position', item.position, 'isNext', item.is_next,
    'pinnedToToday', item.pinned_to_today, 'scheduledFor', item.scheduled_for,
    'completedAt', item.completed_at, 'skippedAt', item.skipped_at, 'cancelledAt', item.cancelled_at,
    'recurringTemplateId', item.recurring_template_id, 'occurrenceDate', item.occurrence_date,
    'checklist', item.checklist, 'legacySourceId', item.legacy_source_id,
    'createdAt', item.created_at, 'updatedAt', item.updated_at
  ) order by item.row_no) from visible item), '[]'::jsonb),
  'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 30), 100)) + 1)
    then (select jsonb_build_object('sortValue', item.sort_value, 'id', item.id)
      from visible item order by item.row_no desc limit 1)
    else null end
);
$$;
revoke all on function public.get_waiting_actions_page(uuid, text, uuid, uuid, date, integer, text, uuid) from public, anon;
grant execute on function public.get_waiting_actions_page(uuid, text, uuid, uuid, date, integer, text, uuid) to authenticated;
