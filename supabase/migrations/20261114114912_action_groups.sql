-- Preserve every Goal identity and all foreign keys. Existing Goals become parent tasks.
alter table public.goals add column group_type text not null default 'task'
  check (group_type in ('category', 'task'));
alter table public.goals drop constraint goals_outcome_check;
alter table public.goals alter column outcome set default '';
alter table public.goals add constraint category_has_no_outcome_lifecycle
  check (group_type <> 'category' or (status in ('active', 'paused') and target_date is null));

create or replace function private.check_action_group_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.group_type = 'task' and new.group_type = 'category' then
    if old.status <> 'active' or old.archived_at is not null or old.trashed_at is not null or old.target_date is not null
      or exists (select 1 from public.goal_criteria where goal_id = old.id)
      or exists (select 1 from public.progress_entries where goal_id = old.id and kind in ('result','evidence'))
      or exists (select 1 from public.knowledge_links link where link.meaning = 'result' and
        (link.goal_id = old.id or exists (select 1 from public.actions action where action.id = link.action_id and action.goal_id = old.id)))
    then raise exception 'group_conversion_has_outcome_history'; end if;
  end if;
  if new.area_id is distinct from old.area_id and (
    exists (select 1 from public.actions where goal_id = old.id and area_id is not null and area_id is distinct from new.area_id)
    or exists (select 1 from public.recurring_action_templates where goal_id = old.id and area_id is not null and area_id is distinct from new.area_id)
  ) then raise exception 'group_project_has_actions'; end if;
  return new;
end;
$$;
create trigger check_action_group_change before update of group_type, area_id on public.goals
for each row execute function private.check_action_group_change();

create or replace function private.check_group_criterion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- Lock the group too: concurrent criterion creation and conversion must serialize.
  perform 1 from public.goals where id = new.goal_id and workspace_id = new.workspace_id and group_type = 'task' for update;
  if not found then raise exception 'category_has_no_success_criteria'; end if;
  return new;
end;
$$;
create trigger check_group_criterion before insert or update of goal_id on public.goal_criteria
for each row execute function private.check_group_criterion();

create or replace function public.create_goal_with_action(
  target_workspace_id uuid,
  target_goal_id uuid,
  target_action_id uuid,
  goal_title text,
  goal_outcome text,
  goal_kind text,
  target_area_id uuid,
  first_action_title text,
  first_action_detail text,
  command_idempotency_key uuid
)
returns public.goals
language plpgsql
security invoker
set search_path = ''
as $$
declare created_goal public.goals;
declare existing_goal_id uuid;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  select event.entity_ids[1] into existing_goal_id from public.activity_events event
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key
      and event.command_name = 'create_goal_with_action';
  if existing_goal_id is not null then
    select * into created_goal from public.goals where id = existing_goal_id and workspace_id = target_workspace_id;
    return created_goal;
  end if;
  if btrim(goal_title) = '' then raise exception 'goal_title_required'; end if;
  if goal_kind not in ('project', 'learning', 'personal', 'maintenance', 'custom') then raise exception 'invalid_goal_kind'; end if;
  if btrim(coalesce(first_action_title, '')) <> '' and target_action_id is null then raise exception 'action_id_required'; end if;

  insert into public.goals (id, workspace_id, title, outcome, kind, area_id)
  values (target_goal_id, target_workspace_id, btrim(goal_title), btrim(coalesce(goal_outcome, '')), goal_kind, target_area_id)
  returning * into created_goal;
  if btrim(coalesce(first_action_title, '')) <> '' then
    insert into public.actions (id, workspace_id, goal_id, area_id, title, detail, is_next)
    values (target_action_id, target_workspace_id, target_goal_id, target_area_id, btrim(first_action_title), btrim(coalesce(first_action_detail, '')), true);
  end if;
  perform private.append_activity_event_once(target_workspace_id, (select auth.uid()), 'user', 'create_goal_with_action',
    array_remove(array[target_goal_id, target_action_id], null),
    jsonb_build_object('title', goal_title, 'outcome', goal_outcome), command_idempotency_key);
  return created_goal;
end;
$$;

create or replace function public.update_goal_details(
  target_goal_id uuid, goal_changes jsonb, command_idempotency_key uuid
)
returns public.goals
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.goals;
declare criterion jsonb;
declare criterion_ids uuid[] := '{}';
declare criterion_position integer := 0;
begin
  select * into item from public.goals where id = target_goal_id for update;
  if not found then raise exception 'goal_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item; end if;
  if goal_changes ? 'title' and btrim(coalesce(goal_changes ->> 'title', '')) = '' then raise exception 'goal_title_required'; end if;
  update public.goals set
    group_type = case when goal_changes ? 'groupType' then goal_changes ->> 'groupType' else group_type end,
    title = case when goal_changes ? 'title' then btrim(goal_changes ->> 'title') else title end,
    outcome = case when goal_changes ? 'outcome' then btrim(coalesce(goal_changes ->> 'outcome', '')) else outcome end,
    area_id = case when goal_changes ? 'areaId' then nullif(goal_changes ->> 'areaId', '')::uuid else area_id end,
    priority = case when goal_changes ? 'priority' then goal_changes ->> 'priority' else priority end,
    target_date = case when goal_changes ? 'targetDate' then nullif(goal_changes ->> 'targetDate', '')::date else target_date end,
    updated_at = now(), version = version + 1
  where id = target_goal_id returning * into item;
  if goal_changes ? 'criteria' then
    if jsonb_typeof(goal_changes -> 'criteria') <> 'array' then raise exception 'goal_criteria_must_be_array'; end if;
    for criterion in select value from jsonb_array_elements(goal_changes -> 'criteria') loop
      if btrim(coalesce(criterion ->> 'title', '')) = '' then raise exception 'goal_criterion_title_required'; end if;
      criterion_ids := array_append(criterion_ids, (criterion ->> 'id')::uuid);
      insert into public.goal_criteria (id, workspace_id, goal_id, title, completed, position)
      values ((criterion ->> 'id')::uuid, item.workspace_id, item.id, btrim(criterion ->> 'title'),
        coalesce((criterion ->> 'completed')::boolean, false), criterion_position)
      on conflict (id) do update set title = excluded.title, completed = excluded.completed, position = excluded.position;
      criterion_position := criterion_position + 1;
    end loop;
    delete from public.goal_criteria where goal_id = item.id and not (id = any(criterion_ids));
  end if;
  perform private.append_activity_event_once(item.workspace_id, (select auth.uid()), 'user', 'update_goal_details', array[item.id], goal_changes, command_idempotency_key);
  return item;
end;
$$;

create or replace function public.create_action_group(
  target_workspace_id uuid, target_goal_id uuid, target_action_id uuid,
  goal_title text, goal_outcome text, goal_kind text, target_area_id uuid,
  first_action_title text, first_action_detail text, goal_criteria jsonb,
  command_idempotency_key uuid, goal_material_links jsonb default '[]', goal_group_type text default 'task'
)
returns public.goals
language plpgsql
security invoker
set search_path = ''
as $$
declare created_goal public.goals;
declare criterion jsonb;
declare criterion_position integer := 0;
declare knowledge_id uuid;
declare material_link jsonb;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  if goal_group_type not in ('category', 'task') or goal_group_type is null then raise exception 'invalid_group_type'; end if;
  if goal_group_type = 'category' and jsonb_array_length(coalesce(goal_criteria, '[]'::jsonb)) > 0 then raise exception 'category_outcome_fields_forbidden'; end if;
  select goal.* into created_goal from public.activity_events event join public.goals goal on goal.id = event.entity_ids[1]
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key and event.command_name = 'create_goal_with_action';
  if found then
    if created_goal.id <> target_goal_id or created_goal.group_type <> goal_group_type then raise exception 'group_idempotency_conflict'; end if;
    return created_goal;
  end if;
  created_goal := public.create_goal_with_action(target_workspace_id, target_goal_id, target_action_id,
    goal_title, goal_outcome, goal_kind, target_area_id, first_action_title, first_action_detail,
    command_idempotency_key);
  if jsonb_typeof(coalesce(goal_criteria, '[]'::jsonb)) <> 'array' then raise exception 'goal_criteria_must_be_array'; end if;
  for criterion in select value from jsonb_array_elements(coalesce(goal_criteria, '[]'::jsonb)) loop
    if btrim(coalesce(criterion ->> 'title', '')) = '' then raise exception 'goal_criterion_title_required'; end if;
    insert into public.goal_criteria (id, workspace_id, goal_id, title, completed, position)
    values ((criterion ->> 'id')::uuid, target_workspace_id, target_goal_id, btrim(criterion ->> 'title'),
      coalesce((criterion ->> 'completed')::boolean, false), criterion_position)
    on conflict (id) do update set title = excluded.title, completed = excluded.completed, position = excluded.position;
    criterion_position := criterion_position + 1;
  end loop;
  for material_link in select value from jsonb_array_elements(coalesce(goal_material_links, '[]'::jsonb)) loop
    knowledge_id := (material_link ->> 'knowledgeItemId')::uuid;
    if nullif(material_link ->> 'id', '') is null then raise exception 'knowledge_link_id_required'; end if;
    if not exists (select 1 from public.entities entity where entity.id = knowledge_id and entity.workspace_id = target_workspace_id
      and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation') and entity.archived_at is null and entity.trashed_at is null) then
      raise exception 'knowledge_target_not_found';
    end if;
    insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, goal_id, meaning)
    values ((material_link ->> 'id')::uuid, target_workspace_id, knowledge_id, target_goal_id, 'material') on conflict do nothing;
  end loop;
  update public.goals set group_type = goal_group_type where id = created_goal.id returning * into created_goal;
  if goal_group_type = 'category' then update public.actions set is_next = false where goal_id = created_goal.id and is_next; end if;
  return created_goal;
end;
$$;

create or replace function public.triage_inbox_intent(
  target_workspace_id uuid, target_inbox_item_id uuid, target_intent jsonb, command_idempotency_key uuid
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare item public.inbox_items;
declare target_id uuid;
declare goal_id uuid;
declare area_id uuid;
declare action_id uuid;
declare knowledge_id uuid;
declare link_id uuid;
declare resource_format text;
declare resource_author text;
declare reading_status text;
declare criterion jsonb;
declare criterion_position integer := 0;
declare intent_kind text := target_intent ->> 'kind';
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  select event.entity_ids[1] into target_id from public.activity_events event
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key
      and event.command_name = 'triage_inbox_intent';
  if target_id is not null then return target_id; end if;
  select * into item from public.inbox_items where id = target_inbox_item_id and workspace_id = target_workspace_id for update;
  if not found then raise exception 'inbox_item_not_found'; end if;
  if item.status <> 'unprocessed' then raise exception 'inbox_item_not_available'; end if;
  if intent_kind = 'goal' then
    goal_id := (target_intent ->> 'goalId')::uuid; action_id := nullif(target_intent ->> 'actionId', '')::uuid;
    if btrim(coalesce(target_intent ->> 'title', '')) = '' then raise exception 'goal_title_required'; end if;
    if coalesce(target_intent ->> 'goalKind', 'custom') not in ('project', 'learning', 'personal', 'maintenance', 'custom') then raise exception 'invalid_goal_kind'; end if;
    if jsonb_typeof(coalesce(target_intent -> 'criteria', '[]'::jsonb)) <> 'array' then raise exception 'goal_criteria_must_be_array'; end if;
    insert into public.goals (id, workspace_id, title, outcome, kind, area_id, target_date, template_id, group_type)
    values (goal_id, target_workspace_id, btrim(target_intent ->> 'title'), btrim(coalesce(target_intent ->> 'outcome', '')), coalesce(target_intent ->> 'goalKind', 'custom'), nullif(target_intent ->> 'areaId', '')::uuid, nullif(target_intent ->> 'targetDate', '')::date, nullif(target_intent ->> 'templateId', '')::uuid, coalesce(target_intent ->> 'groupType', 'task'));
    for criterion in select value from jsonb_array_elements(coalesce(target_intent -> 'criteria', '[]'::jsonb)) loop
      if btrim(coalesce(criterion ->> 'title', '')) = '' then raise exception 'goal_criterion_title_required'; end if;
      insert into public.goal_criteria (id, workspace_id, goal_id, title, completed, position)
      values ((criterion ->> 'id')::uuid, target_workspace_id, goal_id, btrim(criterion ->> 'title'), false, criterion_position);
      criterion_position := criterion_position + 1;
    end loop;
    if btrim(coalesce(target_intent ->> 'firstActionTitle', '')) <> '' then
      insert into public.actions (id, workspace_id, goal_id, area_id, title, is_next)
      values (action_id, target_workspace_id, goal_id, nullif(target_intent ->> 'areaId', '')::uuid, btrim(target_intent ->> 'firstActionTitle'), coalesce(target_intent ->> 'groupType', 'task') = 'task');
    end if;
    target_id := goal_id;
  elsif intent_kind = 'action' then
    action_id := (target_intent ->> 'actionId')::uuid; goal_id := nullif(target_intent ->> 'goalId', '')::uuid;
    if btrim(coalesce(target_intent ->> 'title', '')) = '' then raise exception 'action_title_required'; end if;
    insert into public.actions (id, workspace_id, goal_id, area_id, title, detail, pinned_to_today, scheduled_for)
    values (action_id, target_workspace_id, goal_id, nullif(target_intent ->> 'areaId', '')::uuid,
      btrim(target_intent ->> 'title'), btrim(coalesce(target_intent ->> 'detail', '')),
      coalesce((target_intent ->> 'pinnedToToday')::boolean, false), nullif(target_intent ->> 'targetDate', '')::date);
    target_id := action_id;
  elsif intent_kind = 'knowledge' then
    knowledge_id := (target_intent ->> 'knowledgeId')::uuid;
    goal_id := nullif(target_intent ->> 'goalId', '')::uuid; area_id := nullif(target_intent ->> 'projectId', '')::uuid;
    link_id := nullif(target_intent ->> 'linkId', '')::uuid;
    resource_format := nullif(target_intent ->> 'resourceFormat', '');
    resource_author := nullif(btrim(coalesce(target_intent ->> 'resourceAuthor', '')), '');
    reading_status := nullif(target_intent ->> 'readingStatus', '');
    if btrim(coalesce(target_intent ->> 'title', '')) = '' then raise exception 'knowledge_title_required'; end if;
    if target_intent ->> 'knowledgeKind' not in ('note', 'resource', 'decision', 'artifact', 'investigation') then raise exception 'invalid_knowledge_kind'; end if;
    if resource_format is not null and resource_format <> 'book' then raise exception 'invalid_resource_format'; end if;
    if resource_format = 'book' and target_intent ->> 'knowledgeKind' <> 'resource' then raise exception 'book_requires_resource'; end if;
    if resource_format is null and (resource_author is not null or reading_status is not null) then raise exception 'book_fields_require_format'; end if;
    if reading_status is not null and reading_status not in ('to_read', 'reading', 'read', 'paused', 'abandoned') then raise exception 'reading_status_invalid'; end if;
    insert into public.entities (id, workspace_id, type, title)
    values (knowledge_id, target_workspace_id, (target_intent ->> 'knowledgeKind')::public.entity_type, btrim(target_intent ->> 'title'));
    insert into public.knowledge_items (entity_id, workspace_id, detail, source_url, source_inbox_item_id, resource_format, resource_author, reading_status)
    values (knowledge_id, target_workspace_id, btrim(coalesce(target_intent ->> 'detail', '')), nullif(btrim(coalesce(target_intent ->> 'sourceUrl', '')), ''), item.id,
      resource_format, resource_author, case when resource_format = 'book' then coalesce(reading_status, 'to_read') else null end);
    if goal_id is not null then
      insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, goal_id, meaning)
      values (link_id, target_workspace_id, knowledge_id, goal_id, case target_intent ->> 'knowledgeKind' when 'decision' then 'decision' when 'artifact' then 'result' when 'note' then 'reference' else 'material' end);
    end if;
    if area_id is not null then
      if not exists (select 1 from public.areas where id = area_id and workspace_id = target_workspace_id) then raise exception 'area_not_found'; end if;
      insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, area_id, meaning)
      values (case when goal_id is not null then (target_intent ->> 'projectLinkId')::uuid else link_id end, target_workspace_id, knowledge_id, area_id, case target_intent ->> 'knowledgeKind' when 'decision' then 'decision' when 'artifact' then 'result' when 'note' then 'reference' else 'material' end);
    end if;
    if nullif(target_intent ->> 'sourceBookId', '') is not null then
      if target_intent ->> 'knowledgeKind' <> 'note' or not exists (
        select 1 from public.knowledge_items knowledge join public.entities entity on entity.id = knowledge.entity_id and entity.workspace_id = knowledge.workspace_id
        where knowledge.entity_id = (target_intent ->> 'sourceBookId')::uuid and knowledge.workspace_id = target_workspace_id
          and knowledge.resource_format = 'book' and entity.trashed_at is null
      ) then raise exception 'source_book_not_found'; end if;
      insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, target_knowledge_entity_id, meaning)
      values ((target_intent ->> 'sourceLinkId')::uuid, target_workspace_id, knowledge_id, (target_intent ->> 'sourceBookId')::uuid, 'source');
    end if;
    target_id := knowledge_id;
  else raise exception 'invalid_inbox_intent';
  end if;
  update public.inbox_items set status = 'resolved', resolved_at = now(), snoozed_until = null where id = item.id;
  perform private.append_activity_event_once(target_workspace_id, (select auth.uid()), 'user', 'triage_inbox_intent', array[target_id],
    jsonb_build_object('inboxItemId', item.id, 'intent', intent_kind), command_idempotency_key);
  return target_id;
end;
$$;

revoke all on function public.create_action_group(uuid,uuid,uuid,text,text,text,uuid,text,text,jsonb,uuid,jsonb,text) from public, anon;
grant execute on function public.create_action_group(uuid,uuid,uuid,text,text,text,uuid,text,text,jsonb,uuid,jsonb,text) to authenticated;


create or replace function public.get_workspace_core(target_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with membership as (
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = target_user_id
    and wm.user_id = (select auth.uid())
  limit 1
)
select jsonb_build_object(
  'workspaceId', w.id,
  'workspaceTimezone', w.timezone,
  'projectCategories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color) order by c.name) from public.project_categories c where c.workspace_id = w.id), '[]'::jsonb),
  'areas', coalesce((select jsonb_agg(jsonb_build_object(
    'categoryIds', to_jsonb(area.category_ids), 'parentProjectId', area.parent_project_id, 'id', area.id, 'name', area.name, 'description', area.description,
    'color', area.color, 'visibility', case when area.trashed_at is not null then 'trashed' when area.archived_at is not null then 'archived' else 'active' end,
    'createdAt', area.created_at, 'updatedAt', area.updated_at
  ) order by area.name, area.id) from public.areas area where area.workspace_id = w.id and area.archived_at is null and area.trashed_at is null), '[]'::jsonb),
  'goalTemplates', coalesce((select jsonb_agg(jsonb_build_object(
    'id', template.id, 'name', template.name, 'kind', template.kind,
    'outcomePrompt', template.outcome_prompt, 'criterionPrompt', template.criterion_prompt,
    'defaultActions', template.default_actions, 'system', template.is_system,
    'visibility', case when template.trashed_at is not null then 'trashed' when template.archived_at is not null then 'archived' else 'active' end,
    'createdAt', template.created_at, 'updatedAt', template.updated_at
  ) order by template.is_system desc, template.name, template.id) from public.goal_templates template where (template.workspace_id = w.id or template.is_system) and template.archived_at is null and template.trashed_at is null), '[]'::jsonb),
  'goals', coalesce((select jsonb_agg(jsonb_build_object(
    'id', goal.id, 'version', goal.version, 'title', goal.title, 'groupType', goal.group_type, 'outcome', goal.outcome, 'kind', goal.kind,
    'status', goal.status, 'visibility', case when goal.trashed_at is not null then 'trashed' when goal.archived_at is not null then 'archived' else 'active' end,
    'priority', goal.priority, 'areaId', goal.area_id, 'templateId', goal.template_id,
    'targetDate', goal.target_date, 'legacySource', goal.legacy_source,
    'createdAt', goal.created_at, 'updatedAt', goal.updated_at
  ) order by goal.created_at, goal.id) from public.goals goal where goal.workspace_id = w.id and goal.trashed_at is null), '[]'::jsonb),
  'goalCriteria', coalesce((select jsonb_agg(jsonb_build_object(
    'id', criterion.id, 'goalId', criterion.goal_id, 'title', criterion.title,
    'completed', criterion.completed, 'legacySourceId', criterion.legacy_source_id
  ) order by criterion.goal_id, criterion.position, criterion.id) from public.goal_criteria criterion where criterion.workspace_id = w.id), '[]'::jsonb),
  'actions', coalesce((select jsonb_agg(jsonb_build_object(
    'id', action.id, 'version', action.version, 'goalId', action.goal_id, 'areaId', action.area_id,
    'title', action.title, 'detail', action.detail, 'status', action.status, 'blocker', action.blocker,
    'position', action.position, 'isNext', action.is_next, 'pinnedToToday', action.pinned_to_today,
    'scheduledFor', action.scheduled_for, 'completedAt', action.completed_at, 'skippedAt', action.skipped_at,
    'cancelledAt', action.cancelled_at, 'recurringTemplateId', action.recurring_template_id,
    'occurrenceDate', action.occurrence_date, 'checklist', action.checklist,
    'legacySourceId', action.legacy_source_id, 'createdAt', action.created_at, 'updatedAt', action.updated_at
  ) order by action.position, action.id) from public.actions action where action.workspace_id = w.id and action.trashed_at is null and action.archived_at is null and action.status not in ('completed', 'cancelled', 'skipped')), '[]'::jsonb),
  'projects', coalesce((select jsonb_agg(jsonb_build_object(
    'id', entity.id, 'name', entity.title, 'initials', upper(left(regexp_replace(entity.title, '[^[:alnum:]]+', ' ', 'g'), 2)),
    'color', 'violet', 'technology', coalesce(nullif(regexp_replace(project.constraints_md, '.*[Tt]echnologie:\\s*([^\\n]+).*', '\\1'), project.constraints_md), 'Projekt developerski'),
    'outcome', project.outcome,
    'status', case when coalesce(commitment.status::text, '') in ('paused', 'released') or project.status = 'draft' then 'Gotowy do decyzji' when exists (select 1 from public.work_items item where item.primary_context_entity_id = entity.id and item.status = 'blocked') then 'Zagrożony' else 'W trakcie' end,
    'domainStatus', project.status, 'commitmentStatus', commitment.status,
    'nextStep', coalesce((select next_entity.title from public.work_items next_item join public.entities next_entity on next_entity.id = next_item.entity_id where next_item.primary_context_entity_id = entity.id and next_item.status not in ('completed', 'cancelled') order by next_entity.created_at, next_entity.id limit 1), 'Brak następnego kroku'),
    'blocker', (select item.blocker from public.work_items item where item.primary_context_entity_id = entity.id and item.status = 'blocked' order by item.entity_id limit 1),
    'primary', coalesce(commitment.is_primary, false), 'effortBudgetMinutes', commitment.effort_budget_minutes, 'usedMinutes', 0,
    'requirements', coalesce((select jsonb_agg(jsonb_build_object('id', requirement.entity_id, 'title', requirement.description, 'status', requirement.status) order by requirement.entity_id) from public.requirements requirement where requirement.project_id = entity.id), '[]'::jsonb),
    'workItems', coalesce((select jsonb_agg(jsonb_build_object('id', item.entity_id, 'title', item_entity.title, 'detail', item.description, 'completed', item.status = 'completed', 'status', item.status, 'blocker', item.blocker) order by item_entity.created_at, item.entity_id) from public.work_items item join public.entities item_entity on item_entity.id = item.entity_id where item.primary_context_entity_id = entity.id), '[]'::jsonb)
  ) order by entity.created_at, entity.id) from public.entities entity join public.projects project on project.entity_id = entity.id left join lateral (select c.* from public.commitments c where c.target_entity_id = entity.id order by c.started_at desc limit 1) commitment on true where entity.workspace_id = w.id and entity.type = 'project' and entity.trashed_at is null), '[]'::jsonb),
  'recurringActionTemplates', coalesce((select jsonb_agg(jsonb_build_object(
    'id', template.id, 'title', template.title, 'detail', template.detail, 'goalId', template.goal_id, 'areaId', template.area_id,
    'timezone', template.timezone, 'startsOn', template.starts_on, 'rule', template.recurrence_rule, 'missedPolicy', template.missed_policy,
    'status', template.status, 'checklist', template.checklist, 'lastMaterializedOn', template.last_materialized_on,
    'skippedOccurrenceCount', template.skipped_occurrence_count, 'createdAt', template.created_at, 'updatedAt', template.updated_at
  ) order by template.starts_on, template.id) from public.recurring_action_templates template where template.workspace_id = w.id and template.trashed_at is null), '[]'::jsonb),
  'knowledgeLinks', coalesce((select jsonb_agg(jsonb_build_object(
    'id', link.id, 'knowledgeItemId', link.knowledge_entity_id, 'targetKnowledgeItemId', link.target_knowledge_entity_id,
    'areaId', link.area_id, 'goalId', link.goal_id, 'actionId', link.action_id, 'recurringTemplateId', link.recurring_template_id,
    'meaning', link.meaning, 'createdAt', link.created_at
  ) order by link.created_at, link.id) from public.knowledge_links link where link.workspace_id = w.id), '[]'::jsonb),
  'counts', jsonb_build_object(
    'inbox', (select count(*) from public.inbox_items item where item.workspace_id = w.id and item.status = 'unprocessed'),
    'knowledge', (select count(*) from public.entities entity where entity.workspace_id = w.id and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation') and entity.archived_at is null and entity.trashed_at is null),
    'openActions', (select count(*) from public.actions action where action.workspace_id = w.id and action.status not in ('completed', 'cancelled', 'skipped') and action.archived_at is null and action.trashed_at is null),
    'start', (select count(*) from public.actions action where action.workspace_id = w.id and action.pinned_to_today and action.status not in ('completed', 'cancelled', 'skipped') and action.archived_at is null and action.trashed_at is null)
  ),
  'weeklySummary', jsonb_build_object(
    'completedActions', (select count(*) from public.actions action where action.workspace_id = w.id and action.status = 'completed' and action.completed_at >= date_trunc('week', now())),
    'focusMinutes', coalesce((select round(sum(extract(epoch from (session.ended_at - session.started_at)) / 60))::integer from public.focus_sessions session where session.workspace_id = w.id and session.ended_at >= date_trunc('week', now())), 0),
    'knowledgeAdded', (select count(*) from public.knowledge_items item where item.workspace_id = w.id and item.created_at >= date_trunc('week', now())),
    'progressUpdates', (select count(*) from public.progress_entries entry where entry.workspace_id = w.id and entry.created_at >= date_trunc('week', now())),
    'recentReviews', coalesce((select jsonb_agg(jsonb_build_object('id', review.id, 'type', review.type, 'templateVersion', review.template_version, 'answers', review.answers, 'summary', review.summary, 'completedAt', review.completed_at) order by review.completed_at desc) from (select * from public.reviews review where review.workspace_id = w.id order by review.completed_at desc limit 4) review), '[]'::jsonb)
  )
)
from public.workspaces w
join membership on membership.workspace_id = w.id;
$$;

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
      'id', goal.id, 'title', goal.title, 'groupType', goal.group_type, 'outcome', goal.outcome, 'kind', goal.kind,
      'priority', goal.priority, 'targetDate', goal.target_date,
      'area', case when area.id is null then null else jsonb_build_object('id', area.id, 'name', area.name) end,
      'criteria', coalesce((select jsonb_agg(jsonb_build_object('id', criterion.id, 'title', criterion.title, 'completed', criterion.completed) order by criterion.position, criterion.id) from public.goal_criteria criterion where criterion.workspace_id = target_workspace_id and criterion.goal_id = goal.id), '[]'::jsonb),
      'openActions', coalesce((select jsonb_agg(jsonb_build_object('id', action.id, 'title', action.title, 'status', action.status, 'scheduledFor', action.scheduled_for, 'isNext', action.is_next, 'blocker', action.blocker) order by action.position, action.id) from public.actions action where action.workspace_id = target_workspace_id and action.goal_id = goal.id and action.archived_at is null and action.trashed_at is null and action.status not in ('completed', 'skipped', 'cancelled')), '[]'::jsonb),
      'completed7Days', (select count(*) from public.actions action, settings where action.workspace_id = target_workspace_id and action.goal_id = goal.id and action.status = 'completed' and action.completed_at >= settings.snapshot_at - interval '7 days'),
      'completed28Days', (select count(*) from public.actions action, settings where action.workspace_id = target_workspace_id and action.goal_id = goal.id and action.status = 'completed' and action.completed_at >= settings.snapshot_at - make_interval(days => settings.days)),
      'recentProgress', coalesce((select jsonb_agg(entry.payload order by entry.created_at desc) from (select progress.created_at, jsonb_build_object('kind', progress.kind, 'content', left(progress.content, 500), 'createdAt', progress.created_at) as payload from public.progress_entries progress where progress.workspace_id = target_workspace_id and progress.goal_id = goal.id order by progress.created_at desc limit 5) entry), '[]'::jsonb),
      'lastActivityAt', greatest(goal.updated_at, coalesce((select max(action.updated_at) from public.actions action where action.workspace_id = target_workspace_id and action.goal_id = goal.id), goal.updated_at), coalesce((select max(progress.created_at) from public.progress_entries progress where progress.workspace_id = target_workspace_id and progress.goal_id = goal.id), goal.updated_at)),
      'signals', (select coalesce(jsonb_agg(signal order by signal->>'signalKey'), '[]'::jsonb) from (
        select jsonb_build_object('signalKey', 'goal:' || goal.id || ':missing-next-action', 'kind', 'missing_next_action', 'label', 'brak następnego Działania') as signal where goal.group_type = 'task' and not exists (select 1 from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id and a.is_next and a.status in ('ready', 'in_progress') and a.archived_at is null and a.trashed_at is null)
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':missing-criteria', 'kind', 'missing_criteria', 'label', 'brak kryteriów sukcesu') where goal.group_type = 'task' and not exists (select 1 from public.goal_criteria c where c.workspace_id = target_workspace_id and c.goal_id = goal.id)
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':blocked:' || count(*), 'kind', 'blocked_actions', 'label', count(*) || ' blokad') from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id and a.status = 'blocked' and a.archived_at is null and a.trashed_at is null having count(*) > 0
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':overdue-actions:' || count(*), 'kind', 'overdue_actions', 'label', count(*) || ' zaległych Działań') from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id and a.status not in ('completed', 'skipped', 'cancelled') and a.scheduled_for < current_date and a.archived_at is null and a.trashed_at is null having count(*) > 0
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':overdue-goal', 'kind', 'overdue_goal', 'label', 'przekroczony termin Celu') where goal.target_date < current_date
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':due-soon', 'kind', 'due_soon', 'label', 'termin Celu w ciągu 7 dni') where goal.target_date between current_date and current_date + 7
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':inactive:' || inactivity.days, 'kind', 'inactive', 'label', 'brak aktywności od ' || inactivity.days || ' dni') from (select case when greatest(goal.updated_at, coalesce((select max(a.updated_at) from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id), goal.updated_at), coalesce((select max(p.created_at) from public.progress_entries p where p.workspace_id = target_workspace_id and p.goal_id = goal.id), goal.updated_at)) < now() - interval '30 days' then 30 when greatest(goal.updated_at, coalesce((select max(a.updated_at) from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id), goal.updated_at), coalesce((select max(p.created_at) from public.progress_entries p where p.workspace_id = target_workspace_id and p.goal_id = goal.id), goal.updated_at)) < now() - interval '14 days' then 14 when greatest(goal.updated_at, coalesce((select max(a.updated_at) from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id), goal.updated_at), coalesce((select max(p.created_at) from public.progress_entries p where p.workspace_id = target_workspace_id and p.goal_id = goal.id), goal.updated_at)) < now() - interval '7 days' then 7 end as days) inactivity where inactivity.days is not null and goal.group_type = 'task'
        union all select jsonb_build_object('signalKey', 'goal:' || goal.id || ':too-many-open-actions:' || count(*), 'kind', 'too_many_open_actions', 'label', count(*) || ' równoległych Działań') from public.actions a where a.workspace_id = target_workspace_id and a.goal_id = goal.id and a.status not in ('completed', 'skipped', 'cancelled') and a.archived_at is null and a.trashed_at is null having count(*) > 5 and goal.group_type = 'task'
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

revoke all on function private.check_action_group_change() from public, anon, authenticated;
revoke all on function private.check_group_criterion() from public, anon, authenticated;

-- Normalize project inheritance and serialize reassignments against group changes.
create or replace function private.check_action_group_membership()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare parent public.goals;
begin
  if tg_table_name = 'actions' and tg_op = 'UPDATE' then
    if new.goal_id is distinct from old.goal_id then new.is_next := false; end if;
  end if;
  if new.goal_id is null then return new; end if;
  select * into parent from public.goals where id = new.goal_id and workspace_id = new.workspace_id for share;
  if not found then raise exception 'goal_not_found'; end if;
  if new.area_id is not null and new.area_id is distinct from parent.area_id then raise exception 'goal_project_mismatch'; end if;
  if new.area_id is null then new.area_id := parent.area_id; end if;
  return new;
end;
$$;
revoke all on function private.check_action_group_membership() from public, anon, authenticated;
create trigger check_action_group_membership before insert or update of goal_id, area_id, workspace_id on public.actions
for each row execute function private.check_action_group_membership();
create trigger check_routine_group_membership before insert or update of goal_id, area_id, workspace_id on public.recurring_action_templates
for each row execute function private.check_action_group_membership();
