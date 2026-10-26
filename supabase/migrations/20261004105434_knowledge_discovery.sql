alter table public.inbox_items add column resolved_to_ids uuid[] not null default '{}';

-- Conservative URL comparison shared by old and new clients through an expression index.
create function private.knowledge_url_key(value text) returns text
language plpgsql immutable security invoker set search_path = '' as $$
declare parts text[]; authority text; tail text; scheme text;
begin
  parts := regexp_match(btrim(value), '^(https?)://([^/?#]+)(.*)$', 'i');
  if parts is null then return null; end if;
  if position('@' in parts[2]) > 0 then return btrim(value); end if;
  scheme := lower(parts[1]); authority := lower(parts[2]); tail := parts[3];
  if scheme = 'http' then authority := regexp_replace(authority, ':80$', '');
  else authority := regexp_replace(authority, ':443$', ''); end if;
  if tail = '' or left(tail, 1) in ('?', '#') then tail := '/' || tail; end if;
  return scheme || '://' || authority || tail;
end;
$$;
revoke all on function private.knowledge_url_key(text) from public, anon;
grant execute on function private.knowledge_url_key(text) to authenticated;
-- Hash keeps the index bounded for long URLs; the lookup still checks exact equality.
create index knowledge_url_lookup_idx on public.knowledge_items(workspace_id, md5(private.knowledge_url_key(source_url))) where source_url is not null;

create function public.get_knowledge_suggestions(target_workspace_id uuid, target_source_url text default null, target_project_id uuid default null, excluded_item_ids uuid[] default '{}')
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(public.get_knowledge_item(item.id) order by item.updated_at desc, item.id), '[]'::jsonb)
  from (
    select e.id, e.updated_at from public.entities e
    join public.knowledge_items k on k.entity_id = e.id and k.workspace_id = e.workspace_id
    where e.workspace_id = target_workspace_id and e.archived_at is null and e.trashed_at is null
      and e.type = 'resource' and not (e.id = any(excluded_item_ids))
      and ((target_source_url is not null and md5(private.knowledge_url_key(k.source_url)) = md5(private.knowledge_url_key(target_source_url))
          and private.knowledge_url_key(k.source_url) = private.knowledge_url_key(target_source_url))
        or (target_source_url is null and target_project_id is not null and (
          exists (select 1 from public.knowledge_links l
            left join public.goals g on g.id = l.goal_id and g.workspace_id = l.workspace_id
            left join public.actions a on a.id = l.action_id and a.workspace_id = l.workspace_id
            left join public.goals ag on ag.id = a.goal_id and ag.workspace_id = a.workspace_id
            left join public.recurring_action_templates recurring on recurring.id = l.recurring_template_id and recurring.workspace_id = l.workspace_id
            left join public.goals recurring_goal on recurring_goal.id = recurring.goal_id and recurring_goal.workspace_id = l.workspace_id
            where l.knowledge_entity_id = e.id and l.workspace_id = target_workspace_id
              and (l.area_id = target_project_id or g.area_id = target_project_id or a.area_id = target_project_id or ag.area_id = target_project_id
                or recurring.area_id = target_project_id or recurring_goal.area_id = target_project_id))
          or exists (select 1 from public.knowledge_links source_link
            join public.knowledge_links context_link on context_link.knowledge_entity_id = source_link.knowledge_entity_id and context_link.workspace_id = source_link.workspace_id
            left join public.goals g on g.id = context_link.goal_id and g.workspace_id = context_link.workspace_id
            left join public.actions a on a.id = context_link.action_id and a.workspace_id = context_link.workspace_id
            left join public.goals ag on ag.id = a.goal_id and ag.workspace_id = context_link.workspace_id
            left join public.recurring_action_templates recurring on recurring.id = context_link.recurring_template_id and recurring.workspace_id = context_link.workspace_id
            left join public.goals recurring_goal on recurring_goal.id = recurring.goal_id and recurring_goal.workspace_id = context_link.workspace_id
            where source_link.target_knowledge_entity_id = e.id and source_link.meaning = 'source' and source_link.workspace_id = target_workspace_id
              and (context_link.area_id = target_project_id or g.area_id = target_project_id or a.area_id = target_project_id or ag.area_id = target_project_id
                or recurring.area_id = target_project_id or recurring_goal.area_id = target_project_id)))))
    order by e.updated_at desc, e.id limit 6
  ) item;
$$;
revoke all on function public.get_knowledge_suggestions(uuid,text,uuid,uuid[]) from public, anon;
grant execute on function public.get_knowledge_suggestions(uuid,text,uuid,uuid[]) to authenticated;

create function public.triage_existing_knowledge(target_inbox_id uuid, target_knowledge_id uuid, target_goal_id uuid default null, target_project_id uuid default null, target_link_id uuid default gen_random_uuid())
returns void language plpgsql security invoker set search_path = '' as $$
declare inbox public.inbox_items; material public.entities;
begin
  select * into inbox from public.inbox_items where id = target_inbox_id for update;
  if not found then raise exception 'inbox_item_not_available'; end if;
  if inbox.status = 'resolved' and target_knowledge_id = any(inbox.resolved_to_ids) then return; end if;
  if inbox.status <> 'unprocessed' then raise exception 'inbox_item_not_available'; end if;
  select * into material from public.entities where id = target_knowledge_id and workspace_id = inbox.workspace_id
    and type = 'resource' and archived_at is null and trashed_at is null for update;
  if not found then raise exception 'knowledge_not_available'; end if;
  if target_goal_id is not null and target_project_id is not null then raise exception 'single_context_required'; end if;
  if target_goal_id is not null and not exists (select 1 from public.goals where id = target_goal_id and workspace_id = inbox.workspace_id and archived_at is null and trashed_at is null) then raise exception 'goal_not_available'; end if;
  if target_project_id is not null and not exists (select 1 from public.areas where id = target_project_id and workspace_id = inbox.workspace_id and archived_at is null and trashed_at is null) then raise exception 'project_not_available'; end if;
  if (target_goal_id is not null or target_project_id is not null) and not exists (
    select 1 from public.knowledge_links where workspace_id = inbox.workspace_id and knowledge_entity_id = target_knowledge_id
      and goal_id is not distinct from target_goal_id and area_id is not distinct from target_project_id and meaning = 'material'
  ) then
    insert into public.knowledge_links(id, workspace_id, knowledge_entity_id, goal_id, area_id, meaning)
      values (target_link_id, inbox.workspace_id, target_knowledge_id, target_goal_id, target_project_id, 'material');
  end if;
  update public.inbox_items set status = 'resolved', resolved_to_ids = array_append(coalesce(resolved_to_ids, '{}'::uuid[]), target_knowledge_id), snoozed_until = null where id = inbox.id;
  perform private.append_activity_event_once(inbox.workspace_id,(select auth.uid()),'user','triage_existing_knowledge',array[inbox.id,target_knowledge_id],jsonb_build_object('knowledgeId',target_knowledge_id),target_link_id);
end;
$$;
revoke all on function public.triage_existing_knowledge(uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.triage_existing_knowledge(uuid,uuid,uuid,uuid,uuid) to authenticated;

-- Preserve the resolved destination on a fresh read, independently of navigation.
alter function public.get_inbox_page(uuid,integer,text,uuid) rename to get_inbox_page_before_existing_knowledge;
create function public.get_inbox_page(target_workspace_id uuid, page_size integer default 50, cursor_sort_value text default null, cursor_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
with page as (select public.get_inbox_page_before_existing_knowledge(target_workspace_id,page_size,cursor_sort_value,cursor_id) value)
select page.value || jsonb_build_object('items',coalesce((select jsonb_agg(item.value || jsonb_build_object('resolvedToIds',inbox.resolved_to_ids) order by item.ordinality)
from jsonb_array_elements(page.value -> 'items') with ordinality item(value,ordinality)
join public.inbox_items inbox on inbox.id=(item.value ->> 'id')::uuid),'[]'::jsonb)) from page;
$$;
revoke all on function public.get_inbox_page(uuid,integer,text,uuid) from public, anon;
grant execute on function public.get_inbox_page(uuid,integer,text,uuid) to authenticated;
