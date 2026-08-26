-- Explicit, workspace-scoped Knowledge relations and atomic Action results.
-- The existing tables are intentionally reused; this migration adds no columns.

create or replace function private.enforce_knowledge_relation_meaning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare source_type public.entity_type;
begin
  select entity.type into source_type
    from public.entities entity
    where entity.id = new.knowledge_entity_id and entity.workspace_id = new.workspace_id;
  if new.meaning = 'result' and source_type <> 'artifact' then
    raise exception 'knowledge_result_requires_artifact';
  end if;
  if new.meaning = 'decision' and source_type <> 'decision' then
    raise exception 'knowledge_decision_requires_decision';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_knowledge_type_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.type is distinct from new.type then
    if new.type <> 'artifact' and exists (
      select 1 from public.knowledge_links link
      where link.knowledge_entity_id = new.id and link.workspace_id = new.workspace_id and link.meaning = 'result'
    ) then raise exception 'knowledge_result_requires_artifact'; end if;
    if new.type <> 'decision' and exists (
      select 1 from public.knowledge_links link
      where link.knowledge_entity_id = new.id and link.workspace_id = new.workspace_id and link.meaning = 'decision'
    ) then raise exception 'knowledge_decision_requires_decision'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists knowledge_relation_meaning_guard on public.knowledge_links;
create trigger knowledge_relation_meaning_guard
before insert or update of knowledge_entity_id, workspace_id, meaning on public.knowledge_links
for each row execute procedure private.enforce_knowledge_relation_meaning();

drop trigger if exists knowledge_type_change_guard on public.entities;
create trigger knowledge_type_change_guard
before update of type on public.entities
for each row execute procedure private.enforce_knowledge_type_change();

revoke all on function private.enforce_knowledge_relation_meaning(), private.enforce_knowledge_type_change() from public, anon, authenticated;

create or replace function public.create_knowledge_with_relations(
  target_workspace_id uuid,
  target_knowledge_id uuid,
  knowledge_kind text,
  knowledge_title text,
  knowledge_detail text,
  knowledge_source_url text,
  knowledge_project_id uuid,
  knowledge_source_inbox_id uuid,
  relations jsonb,
  command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare relation jsonb;
declare target jsonb;
declare target_id uuid;
declare source_type text;
declare existing_id uuid;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  select event.entity_ids[1] into existing_id
    from public.activity_events event
    where event.workspace_id = target_workspace_id
      and event.correlation_id = command_idempotency_key
      and event.command_name = 'create_knowledge_with_relations';
  if existing_id is not null then return existing_id; end if;
  if knowledge_kind not in ('note', 'resource', 'decision', 'artifact', 'investigation') then raise exception 'invalid_knowledge_kind'; end if;
  if btrim(coalesce(knowledge_title, '')) = '' then raise exception 'knowledge_title_required'; end if;
  if nullif(btrim(coalesce(knowledge_source_url, '')), '') is not null
    and btrim(knowledge_source_url) !~* '^https?://[^[:space:]]+$' then raise exception 'invalid_knowledge_source_url'; end if;
  if jsonb_typeof(coalesce(relations, '[]'::jsonb)) <> 'array' then raise exception 'knowledge_relations_must_be_array'; end if;

  insert into public.entities (id, workspace_id, type, title)
    values (target_knowledge_id, target_workspace_id, knowledge_kind::public.entity_type, btrim(knowledge_title));
  insert into public.knowledge_items (entity_id, workspace_id, detail, source_url, source_inbox_item_id)
    values (target_knowledge_id, target_workspace_id, btrim(coalesce(knowledge_detail, '')),
      nullif(btrim(coalesce(knowledge_source_url, '')), ''), knowledge_source_inbox_id);

  for relation in select value from jsonb_array_elements(coalesce(relations, '[]'::jsonb)) loop
    target := coalesce(relation -> 'target', '{}'::jsonb);
    if nullif(relation ->> 'id', '') is null then raise exception 'knowledge_link_id_required'; end if;
    if num_nonnulls(
      nullif(target ->> 'targetKnowledgeItemId', '')::uuid,
      nullif(target ->> 'areaId', '')::uuid,
      nullif(target ->> 'goalId', '')::uuid,
      nullif(target ->> 'actionId', '')::uuid,
      nullif(target ->> 'recurringTemplateId', '')::uuid
    ) <> 1 then raise exception 'knowledge_link_target_required'; end if;
    if relation ->> 'meaning' not in ('material', 'result', 'decision', 'reference') then raise exception 'invalid_knowledge_link_meaning'; end if;
    if relation ->> 'meaning' = 'result' and knowledge_kind <> 'artifact' then raise exception 'knowledge_result_requires_artifact'; end if;
    if relation ->> 'meaning' = 'decision' and knowledge_kind <> 'decision' then raise exception 'knowledge_decision_requires_decision'; end if;

    target_id := coalesce(
      nullif(target ->> 'targetKnowledgeItemId', '')::uuid,
      nullif(target ->> 'areaId', '')::uuid,
      nullif(target ->> 'goalId', '')::uuid,
      nullif(target ->> 'actionId', '')::uuid,
      nullif(target ->> 'recurringTemplateId', '')::uuid
    );
    if target ->> 'targetKnowledgeItemId' is not null and not exists (
      select 1 from public.knowledge_items item where item.entity_id = target_id and item.workspace_id = target_workspace_id
    ) then raise exception 'knowledge_target_not_found'; end if;
    if target ->> 'areaId' is not null and not exists (
      select 1 from public.areas item where item.id = target_id and item.workspace_id = target_workspace_id
    ) then raise exception 'area_not_found'; end if;
    if target ->> 'goalId' is not null and not exists (
      select 1 from public.goals item where item.id = target_id and item.workspace_id = target_workspace_id
    ) then raise exception 'goal_not_found'; end if;
    if target ->> 'actionId' is not null and not exists (
      select 1 from public.actions item where item.id = target_id and item.workspace_id = target_workspace_id
    ) then raise exception 'action_not_found'; end if;
    if target ->> 'recurringTemplateId' is not null and not exists (
      select 1 from public.recurring_action_templates item where item.id = target_id and item.workspace_id = target_workspace_id
    ) then raise exception 'recurring_template_not_found'; end if;

    insert into public.knowledge_links (
      id, workspace_id, knowledge_entity_id, target_knowledge_entity_id,
      area_id, goal_id, action_id, recurring_template_id, meaning
    ) values (
      (relation ->> 'id')::uuid, target_workspace_id, target_knowledge_id,
      nullif(target ->> 'targetKnowledgeItemId', '')::uuid,
      nullif(target ->> 'areaId', '')::uuid, nullif(target ->> 'goalId', '')::uuid,
      nullif(target ->> 'actionId', '')::uuid, nullif(target ->> 'recurringTemplateId', '')::uuid,
      relation ->> 'meaning'
    ) on conflict do nothing;
  end loop;

  perform private.append_activity_event_once(
    target_workspace_id, (select auth.uid()), 'user', 'create_knowledge_with_relations', array[target_knowledge_id],
    jsonb_build_object('kind', knowledge_kind, 'relations', jsonb_array_length(coalesce(relations, '[]'::jsonb))), command_idempotency_key
  );
  return target_knowledge_id;
end;
$$;

create or replace function public.record_action_result(
  target_workspace_id uuid,
  target_action_id uuid,
  result_input jsonb,
  target_knowledge_id uuid,
  target_link_id uuid,
  target_progress_id uuid,
  command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare action_item public.actions;
declare existing_result uuid;
declare result_title text;
declare result_kind text;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  select event.entity_ids[1] into existing_result from public.activity_events event
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key
      and event.command_name = 'record_action_result';
  if existing_result is not null then return existing_result; end if;
  select * into action_item from public.actions where id = target_action_id and workspace_id = target_workspace_id for update;
  if not found then raise exception 'action_not_found'; end if;
  select link.knowledge_entity_id into existing_result from public.knowledge_links link
    where link.workspace_id = target_workspace_id and link.action_id = target_action_id and link.meaning = 'result'
    limit 1;
  if existing_result is not null then return existing_result; end if;
  result_kind := result_input ->> 'kind';
  if result_kind = 'new' then
    result_title := btrim(coalesce(result_input ->> 'title', ''));
    if result_title = '' then raise exception 'knowledge_title_required'; end if;
    insert into public.entities (id, workspace_id, type, title)
      values (target_knowledge_id, target_workspace_id, 'artifact', result_title);
    insert into public.knowledge_items (entity_id, workspace_id, detail, source_url)
      values (target_knowledge_id, target_workspace_id, btrim(coalesce(result_input ->> 'detail', '')),
        nullif(btrim(coalesce(result_input ->> 'sourceUrl', '')), ''));
  elsif result_kind = 'existing' then
    select entity.title into result_title from public.entities entity
      where entity.id = target_knowledge_id and entity.workspace_id = target_workspace_id
        and entity.type = 'artifact' and entity.archived_at is null and entity.trashed_at is null;
    if result_title is null then raise exception 'knowledge_result_requires_active_artifact'; end if;
  else
    raise exception 'invalid_action_result';
  end if;
  insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, action_id, meaning)
    values (target_link_id, target_workspace_id, target_knowledge_id, target_action_id, 'result')
    on conflict do nothing;
  if action_item.goal_id is not null and target_progress_id is not null then
    insert into public.progress_entries (id, workspace_id, goal_id, action_id, knowledge_entity_id, kind, content)
      values (target_progress_id, target_workspace_id, action_item.goal_id, action_item.id, target_knowledge_id, 'result', 'Rezultat: ' || result_title)
      on conflict do nothing;
  end if;
  perform private.append_activity_event_once(
    target_workspace_id, (select auth.uid()), 'user', 'record_action_result', array[target_knowledge_id, target_action_id],
    jsonb_build_object('actionId', target_action_id, 'resultKind', result_kind), command_idempotency_key
  );
  return target_knowledge_id;
end;
$$;

revoke all on function public.create_knowledge_with_relations(uuid, uuid, text, text, text, text, uuid, uuid, jsonb, uuid),
  public.record_action_result(uuid, uuid, jsonb, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.create_knowledge_with_relations(uuid, uuid, text, text, text, text, uuid, uuid, jsonb, uuid),
  public.record_action_result(uuid, uuid, jsonb, uuid, uuid, uuid, uuid) to authenticated;
