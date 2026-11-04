-- Preserve triage as one atomic operation while accepting the shared Goal fields.
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
    if btrim(coalesce(target_intent ->> 'outcome', '')) = '' then raise exception 'goal_outcome_required'; end if;
    if coalesce(target_intent ->> 'goalKind', 'custom') not in ('project', 'learning', 'personal', 'maintenance', 'custom') then raise exception 'invalid_goal_kind'; end if;
    if jsonb_typeof(coalesce(target_intent -> 'criteria', '[]'::jsonb)) <> 'array' then raise exception 'goal_criteria_must_be_array'; end if;
    insert into public.goals (id, workspace_id, title, outcome, kind, area_id, target_date, template_id)
    values (goal_id, target_workspace_id, btrim(target_intent ->> 'title'), btrim(target_intent ->> 'outcome'), coalesce(target_intent ->> 'goalKind', 'custom'), nullif(target_intent ->> 'areaId', '')::uuid, nullif(target_intent ->> 'targetDate', '')::date, nullif(target_intent ->> 'templateId', '')::uuid);
    for criterion in select value from jsonb_array_elements(coalesce(target_intent -> 'criteria', '[]'::jsonb)) loop
      if btrim(coalesce(criterion ->> 'title', '')) = '' then raise exception 'goal_criterion_title_required'; end if;
      insert into public.goal_criteria (id, workspace_id, goal_id, title, completed, position)
      values ((criterion ->> 'id')::uuid, target_workspace_id, goal_id, btrim(criterion ->> 'title'), false, criterion_position);
      criterion_position := criterion_position + 1;
    end loop;
    if btrim(coalesce(target_intent ->> 'firstActionTitle', '')) <> '' then
      insert into public.actions (id, workspace_id, goal_id, area_id, title, is_next)
      values (action_id, target_workspace_id, goal_id, nullif(target_intent ->> 'areaId', '')::uuid, btrim(target_intent ->> 'firstActionTitle'), true);
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
revoke all on function public.triage_inbox_intent(uuid, uuid, jsonb, uuid) from public, anon;
grant execute on function public.triage_inbox_intent(uuid, uuid, jsonb, uuid) to authenticated;
