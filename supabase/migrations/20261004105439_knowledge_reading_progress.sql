alter table public.knowledge_items
  add column revisit_on date,
  add column current_page integer check (current_page >= 0),
  add column total_pages integer check (total_pages > 0),
  add column reading_location text check (length(reading_location) <= 200),
  add constraint knowledge_pages_valid check (current_page is null or total_pages is null or current_page <= total_pages);
create index knowledge_revisit_idx on public.knowledge_items(workspace_id,revisit_on,entity_id) where revisit_on is not null;

alter function public.update_knowledge_item(uuid,jsonb,jsonb,uuid) rename to update_knowledge_item_before_reading;
create function public.update_knowledge_item(target_knowledge_id uuid, knowledge_changes jsonb, goal_links jsonb, command_idempotency_key uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare item public.entities; content public.knowledge_items;
begin
  select * into item from public.entities where id = target_knowledge_id for update;
  if not found then raise exception 'knowledge_not_found'; end if;
  if exists (select 1 from public.activity_events where workspace_id=item.workspace_id and correlation_id=command_idempotency_key) then return item.id; end if;
  perform public.update_knowledge_item_before_reading(target_knowledge_id,knowledge_changes,goal_links,command_idempotency_key);
  select * into item from public.entities where id=target_knowledge_id;
  select * into content from public.knowledge_items where entity_id=target_knowledge_id;
  if knowledge_changes ? 'revisitOn' and knowledge_changes ->> 'revisitOn' is not null and (item.type not in ('resource','note') or item.archived_at is not null or item.trashed_at is not null) then raise exception 'revisit_requires_active_material'; end if;
  if (knowledge_changes ->> 'currentPage' is not null or knowledge_changes ->> 'totalPages' is not null or knowledge_changes ->> 'readingLocation' is not null) and content.resource_format is distinct from 'book' then raise exception 'book_fields_require_format'; end if;
  if knowledge_changes ->> 'currentPage' is not null and jsonb_typeof(knowledge_changes -> 'currentPage') <> 'number' or knowledge_changes ->> 'totalPages' is not null and jsonb_typeof(knowledge_changes -> 'totalPages') <> 'number' then raise exception 'invalid_reading_pages'; end if;
  -- Parse via text, rejecting fractions rather than PostgreSQL's numeric rounding.
  update public.knowledge_items set
    revisit_on=case when item.type not in ('resource','note') then null when knowledge_changes ? 'revisitOn' then (knowledge_changes ->> 'revisitOn')::date else revisit_on end,
    current_page=case when knowledge_changes ? 'currentPage' then (knowledge_changes ->> 'currentPage')::integer else current_page end,
    total_pages=case when knowledge_changes ? 'totalPages' then (knowledge_changes ->> 'totalPages')::integer else total_pages end,
    reading_location=case when knowledge_changes ? 'readingLocation' then nullif(btrim(knowledge_changes ->> 'readingLocation'),'') else reading_location end
  where entity_id=target_knowledge_id;
  return target_knowledge_id;
end;
$$;
revoke all on function public.update_knowledge_item(uuid,jsonb,jsonb,uuid) from public, anon;
grant execute on function public.update_knowledge_item(uuid,jsonb,jsonb,uuid) to authenticated;

alter function public.get_knowledge_item(uuid) rename to get_knowledge_item_before_reading;
create function public.get_knowledge_item(target_item_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
select public.get_knowledge_item_before_reading(target_item_id) || jsonb_build_object('revisitOn',revisit_on,'currentPage',current_page,'totalPages',total_pages,'readingLocation',reading_location)
from public.knowledge_items where entity_id=target_item_id;
$$;
create or replace function public.get_knowledge_items(target_item_ids uuid[]) returns jsonb
language sql stable security invoker set search_path = '' as $$
select coalesce(jsonb_agg(public.get_knowledge_item(entity_id) order by updated_at,entity_id),'[]'::jsonb)
from public.knowledge_items where entity_id=any(target_item_ids);
$$;
revoke all on function public.get_knowledge_item(uuid) from public, anon;
grant execute on function public.get_knowledge_item(uuid) to authenticated;

drop function public.get_knowledge_page(uuid, integer, text, uuid, text, text, text, text, uuid, uuid, text);
create function public.get_knowledge_page(
  target_workspace_id uuid,
  page_size integer default 50,
  cursor_sort_value text default null,
  cursor_id uuid default null,
  target_resource_format text default null,
  target_reading_status text default null,
  target_knowledge_kind text default null,
  target_search_text text default null,
  target_project_id uuid default null,
  target_goal_id uuid default null,
  target_visibility text default 'active',
  target_revisit_on date default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with filtered as materialized (
  select entity.id, entity.version, entity.type, entity.title, entity.archived_at, entity.trashed_at,
    content.detail, content.source_url, content.source_inbox_item_id, content.resource_format,
    content.resource_author, content.reading_status, content.revisit_on, content.created_at, content.updated_at
  from public.entities entity
  join public.knowledge_items content on content.entity_id = entity.id and content.workspace_id = entity.workspace_id
  where entity.workspace_id = target_workspace_id
    and private.is_workspace_member(entity.workspace_id)
    and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation')
    and (target_visibility is null or target_visibility = 'all'
      or (target_visibility = 'active' and entity.archived_at is null and entity.trashed_at is null)
      or (target_visibility = 'archived' and entity.archived_at is not null and entity.trashed_at is null)
      or (target_visibility = 'trashed' and entity.trashed_at is not null))
    and (target_revisit_on is null or (entity.type in ('resource','note') and entity.archived_at is null and entity.trashed_at is null and content.revisit_on <= target_revisit_on))
    and (target_resource_format is null or content.resource_format = target_resource_format)
    and (target_reading_status is null or (content.resource_format = 'book' and content.reading_status = target_reading_status))
    and (target_knowledge_kind is null or entity.type::text = target_knowledge_kind)
    and (nullif(btrim(target_search_text), '') is null or entity.title ilike '%' || target_search_text || '%'
      or content.detail ilike '%' || target_search_text || '%' or content.resource_author ilike '%' || target_search_text || '%')
    and (target_goal_id is null or exists (
      select 1 from public.knowledge_links link
      left join public.actions action on action.id = link.action_id and action.workspace_id = link.workspace_id
      where link.workspace_id = target_workspace_id and link.knowledge_entity_id = entity.id
        and (link.goal_id = target_goal_id or action.goal_id = target_goal_id)
    ))
    and (target_project_id is null or exists (
      select 1 from public.knowledge_links link
      left join public.goals direct_goal on direct_goal.id = link.goal_id and direct_goal.workspace_id = link.workspace_id
      left join public.actions action on action.id = link.action_id and action.workspace_id = link.workspace_id
      left join public.goals action_goal on action_goal.id = action.goal_id and action_goal.workspace_id = link.workspace_id
      left join public.recurring_action_templates recurring on recurring.id = link.recurring_template_id and recurring.workspace_id = link.workspace_id
      left join public.goals recurring_goal on recurring_goal.id = recurring.goal_id and recurring_goal.workspace_id = link.workspace_id
      where link.workspace_id = target_workspace_id and link.knowledge_entity_id = entity.id
        and (link.area_id = target_project_id or direct_goal.area_id = target_project_id
          or action.area_id = target_project_id or action_goal.area_id = target_project_id
          or recurring.area_id = target_project_id or recurring_goal.area_id = target_project_id)
    ) or exists (
      select 1
      from public.knowledge_links source_link
      join public.knowledge_links context_link on context_link.knowledge_entity_id = source_link.knowledge_entity_id
        and context_link.workspace_id = source_link.workspace_id
      left join public.goals direct_goal on direct_goal.id = context_link.goal_id and direct_goal.workspace_id = context_link.workspace_id
      left join public.actions action on action.id = context_link.action_id and action.workspace_id = context_link.workspace_id
      left join public.goals action_goal on action_goal.id = action.goal_id and action_goal.workspace_id = context_link.workspace_id
      left join public.recurring_action_templates recurring on recurring.id = context_link.recurring_template_id and recurring.workspace_id = context_link.workspace_id
      left join public.goals recurring_goal on recurring_goal.id = recurring.goal_id and recurring_goal.workspace_id = context_link.workspace_id
      where source_link.workspace_id = target_workspace_id and source_link.target_knowledge_entity_id = entity.id
        and source_link.meaning = 'source'
        and (context_link.area_id = target_project_id or direct_goal.area_id = target_project_id
          or action.area_id = target_project_id or action_goal.area_id = target_project_id
          or recurring.area_id = target_project_id or recurring_goal.area_id = target_project_id)
    ))
), ranked as (
  select filtered.*, row_number() over (order by case when target_revisit_on is null then updated_at::text else revisit_on::text end, id) as row_no
  from filtered
  where cursor_sort_value is null or (case when target_revisit_on is null then updated_at::text else revisit_on::text end, id::text) > (cursor_sort_value, cursor_id::text)
  order by case when target_revisit_on is null then updated_at::text else revisit_on::text end, id
  limit greatest(1, least(coalesce(page_size, 50), 100)) + 1
), visible as (
  select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 50), 100))
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(public.get_knowledge_item(item.id) order by case when target_revisit_on is null then item.updated_at::text else item.revisit_on::text end, item.id) from visible item), '[]'::jsonb),
  'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 50), 100)) + 1)
    then (select jsonb_build_object('sortValue', case when target_revisit_on is null then item.updated_at::text else item.revisit_on::text end, 'id', item.id) from visible item order by case when target_revisit_on is null then item.updated_at::text else item.revisit_on::text end desc, item.id desc limit 1)
    else null end,
  'totalCount', (select count(*) from filtered)
);
$$;

revoke all on function public.get_knowledge_page(uuid, integer, text, uuid, text, text, text, text, uuid, uuid, text, date) from public, anon;
grant execute on function public.get_knowledge_page(uuid, integer, text, uuid, text, text, text, text, uuid, uuid, text, date) to authenticated;
