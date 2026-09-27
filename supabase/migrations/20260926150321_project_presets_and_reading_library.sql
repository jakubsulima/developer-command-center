-- Project presets and Reading Library extend existing records. Existing
-- Projects remain Standard by default; categories only suggest a preset.
alter table public.areas
  add column preset text not null default 'standard'
  check (preset in ('standard', 'reading'));

alter table public.project_categories
  add column default_preset text
  check (default_preset is null or default_preset in ('standard', 'reading'));

alter table public.knowledge_items
  add column resource_format text,
  add column resource_author text,
  add column reading_status text,
  add constraint knowledge_items_resource_format_check
    check (resource_format is null or resource_format = 'book'),
  add constraint knowledge_items_reading_status_check
    check (reading_status is null or reading_status in ('to_read', 'reading', 'read', 'paused', 'abandoned'));

alter table public.knowledge_links drop constraint knowledge_links_meaning_check;
alter table public.knowledge_links add constraint knowledge_links_meaning_check
  check (meaning in ('material', 'result', 'decision', 'reference', 'source'));

create or replace function private.enforce_knowledge_relation_meaning()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare source_type public.entity_type;
declare target_type public.entity_type;
declare target_trashed_at timestamptz;
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
  if new.target_knowledge_entity_id is not null then
    select entity.type, entity.trashed_at into target_type, target_trashed_at
      from public.entities entity
      where entity.id = new.target_knowledge_entity_id and entity.workspace_id = new.workspace_id;
    if target_trashed_at is not null then raise exception 'knowledge_target_trashed'; end if;
  end if;
  if new.meaning = 'source' then
    if source_type <> 'note' or new.target_knowledge_entity_id is null then
      raise exception 'knowledge_source_requires_note_and_material';
    end if;
    if target_type <> 'resource' then
      raise exception 'knowledge_source_requires_note_and_material';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_knowledge_type_change()
returns trigger
language plpgsql
security invoker
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
    if new.type <> 'note' and exists (
      select 1 from public.knowledge_links link
      where link.knowledge_entity_id = new.id and link.workspace_id = new.workspace_id and link.meaning = 'source'
    ) then raise exception 'knowledge_source_requires_note_and_material'; end if;
    if new.type <> 'resource' and exists (
      select 1 from public.knowledge_links link
      where link.target_knowledge_entity_id = new.id and link.workspace_id = new.workspace_id and link.meaning = 'source'
    ) then raise exception 'knowledge_source_target_must_be_resource'; end if;
    if new.type <> 'resource' then
      update public.knowledge_items set resource_format = null
        where entity_id = new.id and workspace_id = new.workspace_id and resource_format is not null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.validate_knowledge_resource_format()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare item_type public.entity_type;
begin
  if new.resource_format = 'book' then
    select entity.type into item_type from public.entities entity
      where entity.id = new.entity_id and entity.workspace_id = new.workspace_id;
    if item_type <> 'resource' then raise exception 'book_requires_resource'; end if;
    new.reading_status := coalesce(new.reading_status, 'to_read');
  end if;
  return new;
end;
$$;

drop trigger if exists knowledge_resource_format_guard on public.knowledge_items;
create trigger knowledge_resource_format_guard
before insert or update of resource_format, reading_status on public.knowledge_items
for each row execute function private.validate_knowledge_resource_format();

drop trigger if exists knowledge_relation_meaning_guard on public.knowledge_links;
create trigger knowledge_relation_meaning_guard
before insert or update of knowledge_entity_id, target_knowledge_entity_id, workspace_id, meaning on public.knowledge_links
for each row execute function private.enforce_knowledge_relation_meaning();

drop trigger if exists knowledge_type_change_guard on public.entities;
create trigger knowledge_type_change_guard
before update of type on public.entities
for each row execute function private.enforce_knowledge_type_change();

revoke all on function private.enforce_knowledge_relation_meaning(), private.enforce_knowledge_type_change(), private.validate_knowledge_resource_format() from public, anon, authenticated;

drop function public.create_knowledge_with_relations(uuid, uuid, text, text, text, text, uuid, uuid, jsonb, uuid);
create function public.create_knowledge_with_relations(
  target_workspace_id uuid,
  target_knowledge_id uuid,
  knowledge_kind text,
  knowledge_title text,
  knowledge_detail text,
  knowledge_source_url text,
  knowledge_project_id uuid,
  knowledge_source_inbox_id uuid,
  relations jsonb,
  command_idempotency_key uuid,
  knowledge_resource_format text default null,
  knowledge_resource_author text default null,
  knowledge_reading_status text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare relation jsonb;
declare target jsonb;
declare target_id uuid;
declare existing_id uuid;
declare target_type public.entity_type;
declare target_trashed_at timestamptz;
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
  if knowledge_resource_format is not null and knowledge_resource_format <> 'book' then raise exception 'invalid_resource_format'; end if;
  if knowledge_resource_format = 'book' and knowledge_kind <> 'resource' then raise exception 'book_requires_resource'; end if;
  if knowledge_reading_status is not null and knowledge_reading_status not in ('to_read', 'reading', 'read', 'paused', 'abandoned') then raise exception 'reading_status_invalid'; end if;
  if knowledge_resource_format is null and (knowledge_resource_author is not null or knowledge_reading_status is not null) then raise exception 'book_fields_require_format'; end if;
  if jsonb_typeof(coalesce(relations, '[]'::jsonb)) <> 'array' then raise exception 'knowledge_relations_must_be_array'; end if;

  insert into public.entities (id, workspace_id, type, title)
    values (target_knowledge_id, target_workspace_id, knowledge_kind::public.entity_type, btrim(knowledge_title));
  insert into public.knowledge_items (
    entity_id, workspace_id, detail, source_url, source_inbox_item_id,
    resource_format, resource_author, reading_status
  ) values (
    target_knowledge_id, target_workspace_id, btrim(coalesce(knowledge_detail, '')),
    nullif(btrim(coalesce(knowledge_source_url, '')), ''), knowledge_source_inbox_id,
    knowledge_resource_format, nullif(btrim(coalesce(knowledge_resource_author, '')), ''),
    case when knowledge_resource_format = 'book' then coalesce(knowledge_reading_status, 'to_read') else null end
  );

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
    if relation ->> 'meaning' not in ('material', 'result', 'decision', 'reference', 'source') then raise exception 'invalid_knowledge_link_meaning'; end if;
    if relation ->> 'meaning' = 'result' and knowledge_kind <> 'artifact' then raise exception 'knowledge_result_requires_artifact'; end if;
    if relation ->> 'meaning' = 'decision' and knowledge_kind <> 'decision' then raise exception 'knowledge_decision_requires_decision'; end if;
    if relation ->> 'meaning' = 'source' and (knowledge_kind <> 'note' or target ->> 'targetKnowledgeItemId' is null) then raise exception 'knowledge_source_requires_note_and_material'; end if;

    target_id := coalesce(
      nullif(target ->> 'targetKnowledgeItemId', '')::uuid,
      nullif(target ->> 'areaId', '')::uuid,
      nullif(target ->> 'goalId', '')::uuid,
      nullif(target ->> 'actionId', '')::uuid,
      nullif(target ->> 'recurringTemplateId', '')::uuid
    );
    if target ->> 'targetKnowledgeItemId' is not null then
      select entity.type, entity.trashed_at into target_type, target_trashed_at from public.entities entity
        where entity.id = target_id and entity.workspace_id = target_workspace_id;
      if target_type is null then raise exception 'knowledge_target_not_found'; end if;
      if target_trashed_at is not null then raise exception 'knowledge_target_trashed'; end if;
      if relation ->> 'meaning' = 'source' and target_type <> 'resource' then raise exception 'knowledge_source_requires_note_and_material'; end if;
    end if;
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

revoke all on function public.create_knowledge_with_relations(uuid, uuid, text, text, text, text, uuid, uuid, jsonb, uuid, text, text, text) from public, anon;
grant execute on function public.create_knowledge_with_relations(uuid, uuid, text, text, text, text, uuid, uuid, jsonb, uuid, text, text, text) to authenticated;

-- Keep Knowledge edits, filters and project shelves on the same records and
-- enforce book metadata at the persistence boundary.
create or replace function public.update_knowledge_item(
  target_knowledge_id uuid, knowledge_changes jsonb, goal_links jsonb, command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.entities;
declare link jsonb;
declare retained_goal_ids uuid[] := '{}';
declare next_kind text;
declare next_format text;
begin
  select * into item from public.entities where id = target_knowledge_id for update;
  if not found or item.type not in ('note', 'resource', 'decision', 'artifact', 'investigation') then raise exception 'knowledge_not_found'; end if;
  if not private.is_workspace_member(item.workspace_id) then raise exception 'workspace_access_denied'; end if;
  if exists (select 1 from public.activity_events where workspace_id = item.workspace_id and correlation_id = command_idempotency_key) then return item.id; end if;
  if knowledge_changes ? 'title' and btrim(coalesce(knowledge_changes ->> 'title', '')) = '' then raise exception 'knowledge_title_required'; end if;
  if knowledge_changes ? 'kind' and knowledge_changes ->> 'kind' not in ('note', 'resource', 'decision', 'artifact', 'investigation') then raise exception 'invalid_knowledge_kind'; end if;
  if knowledge_changes ? 'sourceUrl' and nullif(btrim(coalesce(knowledge_changes ->> 'sourceUrl', '')), '') is not null
    and btrim(knowledge_changes ->> 'sourceUrl') !~* '^https?://[^[:space:]]+$' then raise exception 'invalid_knowledge_source_url'; end if;
  next_kind := coalesce(knowledge_changes ->> 'kind', item.type::text);
  next_format := case when knowledge_changes ? 'resourceFormat' then nullif(knowledge_changes ->> 'resourceFormat', '') else null end;
  if knowledge_changes ? 'resourceFormat' and next_format is not null and next_format <> 'book' then raise exception 'invalid_resource_format'; end if;
  if next_format = 'book' and next_kind <> 'resource' then raise exception 'book_requires_resource'; end if;
  if knowledge_changes ? 'readingStatus' and nullif(knowledge_changes ->> 'readingStatus', '') is not null
    and knowledge_changes ->> 'readingStatus' not in ('to_read', 'reading', 'read', 'paused', 'abandoned') then raise exception 'reading_status_invalid'; end if;
  if knowledge_changes ? 'resourceAuthor' and nullif(btrim(coalesce(knowledge_changes ->> 'resourceAuthor', '')), '') is not null
    and next_format is null and next_kind = 'resource' and not exists (
      select 1 from public.knowledge_items content where content.entity_id = item.id and content.resource_format = 'book'
    ) then raise exception 'book_fields_require_format'; end if;
  update public.entities set
    title = case when knowledge_changes ? 'title' then btrim(knowledge_changes ->> 'title') else title end,
    type = next_kind::public.entity_type,
    updated_at = now(), version = version + 1
  where id = item.id;
  update public.knowledge_items set
    detail = case when knowledge_changes ? 'detail' then btrim(coalesce(knowledge_changes ->> 'detail', '')) else detail end,
    source_url = case when knowledge_changes ? 'sourceUrl' then nullif(btrim(coalesce(knowledge_changes ->> 'sourceUrl', '')), '') else source_url end,
    resource_format = case when next_kind <> 'resource' then null
      when knowledge_changes ? 'resourceFormat' then next_format else resource_format end,
    resource_author = case when next_kind <> 'resource' then null
      when knowledge_changes ? 'resourceFormat' and next_format is null then resource_author
      when knowledge_changes ? 'resourceAuthor' then nullif(btrim(coalesce(knowledge_changes ->> 'resourceAuthor', '')), '') else resource_author end,
    reading_status = case when next_kind <> 'resource' then null
      when knowledge_changes ? 'resourceFormat' and next_format is null then reading_status
      when knowledge_changes ? 'readingStatus' then nullif(knowledge_changes ->> 'readingStatus', '')
      when knowledge_changes ? 'resourceFormat' and next_format = 'book' then coalesce(reading_status, 'to_read')
      else reading_status end,
    updated_at = now()
  where entity_id = item.id;
  if goal_links is not null then
    if jsonb_typeof(goal_links) <> 'array' then raise exception 'goal_links_must_be_array'; end if;
    for link in select value from jsonb_array_elements(goal_links) loop
      if not exists (select 1 from public.goals where id = (link ->> 'goalId')::uuid and workspace_id = item.workspace_id) then raise exception 'goal_not_found'; end if;
      retained_goal_ids := array_append(retained_goal_ids, (link ->> 'goalId')::uuid);
      insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, goal_id, meaning)
      values ((link ->> 'id')::uuid, item.workspace_id, item.id, (link ->> 'goalId')::uuid,
        case when next_kind = 'decision' then 'decision' when next_kind = 'artifact' then 'result' else 'reference' end)
      on conflict do nothing;
    end loop;
    delete from public.knowledge_links
      where knowledge_entity_id = item.id and goal_id is not null and not (goal_id = any(retained_goal_ids));
  end if;
  perform private.append_activity_event_once(item.workspace_id, (select auth.uid()), 'user', 'update_knowledge_item', array[item.id], knowledge_changes, command_idempotency_key);
  return item.id;
end;
$$;

revoke all on function public.update_knowledge_item(uuid, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.update_knowledge_item(uuid, jsonb, jsonb, uuid) to authenticated;

drop function public.get_knowledge_page(uuid, integer, text, uuid);
drop function if exists public.get_knowledge_page(uuid, integer, text, uuid, text, text);
drop function if exists public.get_knowledge_page(uuid, integer, text, uuid, text, text, text);
create function public.get_knowledge_page(
  target_workspace_id uuid,
  page_size integer default 50,
  cursor_sort_value text default null,
  cursor_id uuid default null,
  target_resource_format text default null,
  target_reading_status text default null,
  target_knowledge_kind text default null,
  target_search_text text default null
)
returns jsonb language sql stable security invoker as $$
with ranked as (
  select entity.id, entity.version, entity.type, entity.title, content.detail, content.source_url, content.source_inbox_item_id,
    content.resource_format, content.resource_author, content.reading_status, entity.archived_at, entity.trashed_at,
    content.created_at, content.updated_at, row_number() over (order by content.updated_at, entity.id) as row_no
  from public.entities entity join public.knowledge_items content on content.entity_id = entity.id and content.workspace_id = entity.workspace_id
  where entity.workspace_id = target_workspace_id and private.is_workspace_member(entity.workspace_id)
    and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation')
    and (target_resource_format is null or content.resource_format = target_resource_format)
    and (target_reading_status is null or (content.resource_format = 'book' and content.reading_status = target_reading_status))
    and (target_knowledge_kind is null or entity.type::text = target_knowledge_kind)
    and (nullif(btrim(target_search_text), '') is null or entity.title ilike '%' || target_search_text || '%'
      or content.detail ilike '%' || target_search_text || '%' or content.resource_author ilike '%' || target_search_text || '%')
    and (cursor_sort_value is null or (content.updated_at::text, entity.id::text) > (cursor_sort_value, cursor_id::text))
  order by content.updated_at, entity.id
  limit greatest(1, least(coalesce(page_size, 50), 100)) + 1
), visible as (select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 50), 100)))
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(jsonb_build_object(
    'id', item.id, 'version', item.version, 'type', item.type, 'title', item.title, 'detail', item.detail,
    'sourceUrl', item.source_url, 'sourceInboxItemId', item.source_inbox_item_id,
    'resourceFormat', item.resource_format, 'resourceAuthor', item.resource_author, 'readingStatus', item.reading_status,
    'archivedAt', item.archived_at, 'trashedAt', item.trashed_at, 'createdAt', item.created_at, 'updatedAt', item.updated_at
  ) order by item.updated_at, item.id) from visible item), '[]'::jsonb),
  'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 50), 100)) + 1)
    then (select jsonb_build_object('sortValue', item.updated_at::text, 'id', item.id) from visible item order by item.updated_at desc, item.id desc limit 1)
    else null end
);
$$;

create or replace function public.get_knowledge_item(target_item_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
select jsonb_build_object(
  'id', entity.id, 'version', entity.version, 'type', entity.type, 'title', entity.title, 'detail', content.detail,
  'sourceUrl', content.source_url, 'sourceInboxItemId', content.source_inbox_item_id,
  'resourceFormat', content.resource_format, 'resourceAuthor', content.resource_author, 'readingStatus', content.reading_status,
  'archivedAt', entity.archived_at, 'trashedAt', entity.trashed_at, 'createdAt', content.created_at, 'updatedAt', content.updated_at
)
from public.entities entity join public.knowledge_items content on content.entity_id = entity.id and content.workspace_id = entity.workspace_id
where entity.id = target_item_id and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation')
  and private.is_workspace_member(entity.workspace_id);
$$;

create or replace function public.get_knowledge_items(target_item_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'id', entity.id, 'version', entity.version, 'type', entity.type, 'title', entity.title, 'detail', content.detail,
  'sourceUrl', content.source_url, 'sourceInboxItemId', content.source_inbox_item_id,
  'resourceFormat', content.resource_format, 'resourceAuthor', content.resource_author, 'readingStatus', content.reading_status,
  'archivedAt', entity.archived_at, 'trashedAt', entity.trashed_at, 'createdAt', content.created_at, 'updatedAt', content.updated_at
) order by entity.title, entity.id), '[]'::jsonb)
from public.entities entity join public.knowledge_items content on content.entity_id = entity.id and content.workspace_id = entity.workspace_id
where entity.id = any(coalesce(target_item_ids, '{}'::uuid[]))
  and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation')
  and private.is_workspace_member(entity.workspace_id);
$$;

create or replace function public.search_workspace(search_query text, result_limit integer default 20)
returns jsonb language sql stable security invoker set search_path = '' as $$
with member_workspaces as (select wm.workspace_id from public.workspace_members wm where wm.user_id = (select auth.uid())), results as (
  select entity.id, 'goal'::text as type, entity.title, goal.outcome as detail, '/goals/' || entity.id::text as route
    from public.goals goal join public.entities entity on entity.id = goal.id
    where goal.workspace_id in (select workspace_id from member_workspaces) and (goal.title ilike '%' || search_query || '%' or goal.outcome ilike '%' || search_query || '%')
  union all select action.id, 'action', action.title, action.detail, '/actions/' || action.id::text from public.actions action
    where action.workspace_id in (select workspace_id from member_workspaces) and (action.title ilike '%' || search_query || '%' or action.detail ilike '%' || search_query || '%')
  union all select entity.id, 'knowledge', entity.title, content.detail, '/knowledge/' || entity.id::text
    from public.entities entity join public.knowledge_items content on content.entity_id = entity.id
    where entity.workspace_id in (select workspace_id from member_workspaces) and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation')
      and (entity.title ilike '%' || search_query || '%' or content.detail ilike '%' || search_query || '%' or content.resource_author ilike '%' || search_query || '%')
  union all select area.id, 'project', area.name, area.description, '/projects/' || area.id::text from public.areas area
    where area.workspace_id in (select workspace_id from member_workspaces) and area.archived_at is null and area.trashed_at is null
      and (area.name ilike '%' || search_query || '%' or area.description ilike '%' || search_query || '%')
  union all select item.id, 'inbox', item.raw_content, null, '/knowledge?section=inbox&item=' || item.id::text from public.inbox_items item
    where item.workspace_id in (select workspace_id from member_workspaces) and item.raw_content ilike '%' || search_query || '%'
), limited as (
  select * from results where length(btrim(search_query)) >= 2 order by title, id limit greatest(1, least(coalesce(result_limit, 20), 20))
)
select coalesce(jsonb_agg(jsonb_build_object('id', limited.id, 'type', limited.type, 'title', limited.title, 'detail', limited.detail, 'route', limited.route) order by limited.title, limited.id), '[]'::jsonb) from limited;
$$;

revoke all on function public.get_knowledge_page(uuid, integer, text, uuid, text, text, text, text) from public, anon;
grant execute on function public.get_knowledge_page(uuid, integer, text, uuid, text, text, text, text) to authenticated;
revoke all on function public.get_knowledge_items(uuid[]) from public, anon;
grant execute on function public.get_knowledge_items(uuid[]) to authenticated;
revoke all on function public.get_knowledge_item(uuid) from public, anon;
grant execute on function public.get_knowledge_item(uuid) to authenticated;
revoke all on function public.search_workspace(text, integer) from public, anon;
grant execute on function public.search_workspace(text, integer) to authenticated;

-- Creating a Goal or Action from a book persists its material relation in the
-- same transaction as the shared object, preserving retry atomicity.
drop function public.create_goal_with_action_v2(uuid, uuid, uuid, text, text, text, uuid, text, text, jsonb, uuid);
create function public.create_goal_with_action_v2(
  target_workspace_id uuid, target_goal_id uuid, target_action_id uuid,
  goal_title text, goal_outcome text, goal_kind text, target_area_id uuid,
  first_action_title text, first_action_detail text, goal_criteria jsonb,
  command_idempotency_key uuid, goal_material_links jsonb default '[]'
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
  return created_goal;
end;
$$;

drop function public.create_action_item(uuid, uuid, uuid, uuid, text, text, date, boolean, uuid);
create function public.create_action_item(
  target_workspace_id uuid, target_action_id uuid, target_goal_id uuid, target_area_id uuid,
  action_title text, action_detail text, action_scheduled_for date, action_pinned_to_today boolean,
  command_idempotency_key uuid, action_material_links jsonb default '[]'
)
returns public.actions
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.actions;
declare knowledge_id uuid;
declare material_link jsonb;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  if btrim(coalesce(action_title, '')) = '' then raise exception 'action_title_required'; end if;
  select action.* into item from public.activity_events event
    join public.actions action on action.id = event.entity_ids[1]
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key
      and event.command_name = 'create_action_item';
  if found then return item; end if;
  if target_goal_id is not null and not exists (select 1 from public.goals where id = target_goal_id and workspace_id = target_workspace_id) then raise exception 'goal_not_found'; end if;
  if target_area_id is not null and not exists (select 1 from public.areas where id = target_area_id and workspace_id = target_workspace_id) then raise exception 'area_not_found'; end if;
  if target_goal_id is not null and target_area_id is not null and not exists (
    select 1 from public.goals where id = target_goal_id and workspace_id = target_workspace_id and area_id = target_area_id
  ) then raise exception 'goal_project_mismatch'; end if;
  insert into public.actions (id, workspace_id, goal_id, area_id, title, detail, scheduled_for, pinned_to_today, position)
  values (target_action_id, target_workspace_id, target_goal_id, target_area_id, btrim(action_title), btrim(coalesce(action_detail, '')),
    action_scheduled_for, coalesce(action_pinned_to_today, false),
    coalesce((select max(position) + 1 from public.actions where workspace_id = target_workspace_id and goal_id is not distinct from target_goal_id), 0))
  returning * into item;
  for material_link in select value from jsonb_array_elements(coalesce(action_material_links, '[]'::jsonb)) loop
    knowledge_id := (material_link ->> 'knowledgeItemId')::uuid;
    if nullif(material_link ->> 'id', '') is null then raise exception 'knowledge_link_id_required'; end if;
    if not exists (select 1 from public.entities entity where entity.id = knowledge_id and entity.workspace_id = target_workspace_id
      and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation') and entity.archived_at is null and entity.trashed_at is null) then
      raise exception 'knowledge_target_not_found';
    end if;
    insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, action_id, meaning)
    values ((material_link ->> 'id')::uuid, target_workspace_id, knowledge_id, target_action_id, 'material') on conflict do nothing;
  end loop;
  perform private.append_activity_event_once(target_workspace_id, (select auth.uid()), 'user', 'create_action_item', array[item.id],
    jsonb_build_object('goalId', target_goal_id, 'areaId', target_area_id, 'materialKnowledgeIds', coalesce(action_material_links, '[]'::jsonb)), command_idempotency_key);
  return item;
end;
$$;

revoke all on function public.create_goal_with_action_v2(uuid, uuid, uuid, text, text, text, uuid, text, text, jsonb, uuid, jsonb) from public, anon;
grant execute on function public.create_goal_with_action_v2(uuid, uuid, uuid, text, text, text, uuid, text, text, jsonb, uuid, jsonb) to authenticated;
revoke all on function public.create_action_item(uuid, uuid, uuid, uuid, text, text, date, boolean, uuid, jsonb) from public, anon;
grant execute on function public.create_action_item(uuid, uuid, uuid, uuid, text, text, date, boolean, uuid, jsonb) to authenticated;

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
    insert into public.goals (id, workspace_id, title, outcome, kind, area_id, target_date)
    values (goal_id, target_workspace_id, btrim(target_intent ->> 'title'), btrim(target_intent ->> 'outcome'), 'custom', nullif(target_intent ->> 'areaId', '')::uuid, nullif(target_intent ->> 'targetDate', '')::date);
    if btrim(coalesce(target_intent ->> 'firstActionTitle', '')) <> '' then
      insert into public.actions (id, workspace_id, goal_id, title, is_next)
      values (action_id, target_workspace_id, goal_id, btrim(target_intent ->> 'firstActionTitle'), true);
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
    if goal_id is not null and area_id is not null then raise exception 'knowledge_multiple_targets'; end if;
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
      values (link_id, target_workspace_id, knowledge_id, goal_id, case target_intent ->> 'knowledgeKind' when 'decision' then 'decision' when 'artifact' then 'result' else 'material' end);
    elsif area_id is not null then
      if not exists (select 1 from public.areas where id = area_id and workspace_id = target_workspace_id) then raise exception 'area_not_found'; end if;
      insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, area_id, meaning)
      values (link_id, target_workspace_id, knowledge_id, area_id, case target_intent ->> 'knowledgeKind' when 'decision' then 'decision' when 'artifact' then 'result' else 'material' end);
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
