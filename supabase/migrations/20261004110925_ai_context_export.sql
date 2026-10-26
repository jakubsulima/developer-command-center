-- Bound the read response before returning it through the Data API. Content is
-- data; identifiers and provenance are retained even when body text is clipped.
alter function public.get_reviews_page(uuid,integer,text,uuid) set search_path = '';

create function private.bound_context_json(input jsonb, budget integer) returns jsonb
language plpgsql immutable security invoker set search_path = '' as $$
declare output jsonb; entry record; child jsonb; remaining integer := budget; limited boolean := false; index_value integer := 0; value_text text;
begin
  if jsonb_typeof(input) = 'object' then
    output := '{}'::jsonb;
    for entry in select key,value from jsonb_each(input) order by case when key in ('title','name') then 0 when key = 'outcome' then 1 else 2 end, key loop
      if entry.key in ('title','name','description','outcome','detail','blocker','content','readingLocation','sourceUrl') and jsonb_typeof(entry.value) = 'string' then
        value_text := entry.value #>> '{}';
        output := output || jsonb_build_object(entry.key,left(value_text,greatest(0,remaining)));
        limited := limited or length(value_text) > greatest(0,remaining);
        remaining := greatest(0,remaining-length(value_text));
      else
        child := private.bound_context_json(entry.value,remaining);
        output := output || jsonb_build_object(entry.key,child -> 'value');
        remaining := (child ->> 'remaining')::integer;
        limited := limited or (child ->> 'limited')::boolean;
      end if;
    end loop;
  elsif jsonb_typeof(input) = 'array' then
    output := '[]'::jsonb;
    for entry in select value from jsonb_array_elements(input) loop
      index_value := index_value + 1;
      if index_value > 25 then limited := true; exit; end if;
      child := private.bound_context_json(entry.value,remaining);
      output := output || jsonb_build_array(child -> 'value');
      remaining := (child ->> 'remaining')::integer;
      limited := limited or (child ->> 'limited')::boolean;
    end loop;
  else output := input;
  end if;
  return jsonb_build_object('value',output,'remaining',remaining,'limited',limited);
end;
$$;
revoke all on function private.bound_context_json(jsonb,integer) from public, anon;
grant execute on function private.bound_context_json(jsonb,integer) to authenticated;

create function public.get_ai_context_data(target_workspace_id uuid, target_type text, target_id uuid,
  include_project boolean default true, include_goal boolean default true, include_progress boolean default true, include_knowledge boolean default true,
  extra_knowledge_ids uuid[] default '{}', excluded_source_ids text[] default '{}') returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare core jsonb; main_action jsonb; main_goal uuid; main_project uuid; data jsonb; bounded jsonb; root_collection text; root_value jsonb; root_bounded jsonb;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'context_not_available'; end if;
  if cardinality(extra_knowledge_ids) > 10 or cardinality(excluded_source_ids) > 200 then raise exception 'invalid_context_selection'; end if;
  if target_type = 'action' then
    select public.get_action_item(id) || jsonb_build_object('reviewOn',review_on) into main_action from public.actions where id=target_id and workspace_id=target_workspace_id and archived_at is null and trashed_at is null;
    if main_action is null then raise exception 'context_not_available'; end if;
    main_goal := (main_action ->> 'goalId')::uuid;
    main_project := (main_action ->> 'areaId')::uuid;
    if main_goal is not null then select area_id into main_project from public.goals where id=main_goal and workspace_id=target_workspace_id and archived_at is null and trashed_at is null; end if;
  elsif target_type = 'goal' then
    select id,area_id into main_goal,main_project from public.goals where id=target_id and workspace_id=target_workspace_id and archived_at is null and trashed_at is null;
    if not found then raise exception 'context_not_available'; end if;
  elsif target_type = 'project' then
    select id into main_project from public.areas where id=target_id and workspace_id=target_workspace_id and archived_at is null and trashed_at is null;
    if not found then raise exception 'context_not_available'; end if;
  else raise exception 'invalid_context_target'; end if;
  core := public.get_workspace_core((select auth.uid()));
  if (core ->> 'workspaceId')::uuid is distinct from target_workspace_id then raise exception 'context_not_available'; end if;
  with selected_goals as (
    select value from jsonb_array_elements(core -> 'goals') where value ->> 'visibility'='active'
      and ((target_type='project' and value ->> 'areaId'=main_project::text and value ->> 'status'='active' and include_goal)
        or (value ->> 'id'=main_goal::text and (target_type='goal' or include_goal)))
      and (value ->> 'id'=target_id::text or not ('goal:' || (value ->> 'id') = any(excluded_source_ids)))
    order by value ->> 'id' limit 21
  ), selected_actions as (
    select value from jsonb_array_elements(core -> 'actions') where target_type <> 'action'
      and ((target_type='goal' and value ->> 'goalId'=main_goal::text)
        or (target_type='project' and (value ->> 'areaId'=main_project::text or exists (select 1 from public.goals where id=(value ->> 'goalId')::uuid and area_id=main_project and workspace_id=target_workspace_id and archived_at is null and trashed_at is null))))
      and not ('action:' || (value ->> 'id') = any(excluded_source_ids))
    order by (value ->> 'isNext')::boolean desc, (value ->> 'position')::integer, value ->> 'id' limit 21
  ), selected_progress as (
    select p.* from public.progress_entries p join public.goals g on g.id=p.goal_id and g.workspace_id=p.workspace_id
    where include_progress and p.workspace_id=target_workspace_id and g.archived_at is null and g.trashed_at is null
      and ((target_type='action' and (p.action_id=target_id or p.goal_id=main_goal)) or (target_type='goal' and p.goal_id=main_goal) or (target_type='project' and g.area_id=main_project))
      and not ('progress:' || p.id::text = any(excluded_source_ids))
    order by (p.action_id=target_id) desc nulls last, p.created_at desc,p.id desc limit 6
  ), selected_knowledge as (
    select e.id,e.updated_at from public.entities e join public.knowledge_items k on k.entity_id=e.id and k.workspace_id=e.workspace_id
    where include_knowledge and e.workspace_id=target_workspace_id and e.archived_at is null and e.trashed_at is null
      and not ('knowledge:' || e.id::text = any(excluded_source_ids))
      and (e.id=any(extra_knowledge_ids) or exists (select 1 from public.knowledge_links l where l.workspace_id=target_workspace_id and l.knowledge_entity_id=e.id
        and ((target_type='action' and l.action_id=target_id) or l.goal_id=main_goal or l.area_id=main_project)))
    order by array_position(extra_knowledge_ids,e.id) nulls last, e.updated_at desc,e.id limit 11
  )
  select jsonb_build_object(
    'workspaceId',target_workspace_id,
    'areas',coalesce((select jsonb_agg(value) from jsonb_array_elements(core -> 'areas') where value ->> 'id'=main_project::text and value ->> 'visibility'='active' and (include_project or target_type='project')),'[]'::jsonb),
    'goals',coalesce((select jsonb_agg(value) from selected_goals),'[]'::jsonb),
    'goalCriteria',coalesce((select jsonb_agg(value) from jsonb_array_elements(core -> 'goalCriteria') where value ->> 'goalId' in (select value ->> 'id' from selected_goals)),'[]'::jsonb),
    'actions',case when target_type='action' then jsonb_build_array(main_action) else coalesce((select jsonb_agg(value || jsonb_build_object('reviewOn',(select review_on from public.actions where id=(value ->> 'id')::uuid))) from selected_actions),'[]'::jsonb) end,
    'progressEntries',coalesce((select jsonb_agg(jsonb_build_object('id',id,'goalId',goal_id,'actionId',action_id,'knowledgeItemId',knowledge_entity_id,'kind',kind,'content',content,'createdAt',created_at)) from selected_progress),'[]'::jsonb),
    'knowledge',coalesce((select jsonb_agg(public.get_knowledge_item(id)) from selected_knowledge),'[]'::jsonb),
    'contextMismatch',target_type='action' and main_action ->> 'areaId' is not null and main_project::text is distinct from main_action ->> 'areaId'
  ) into data;
  -- Reserve the content budget for the requested object before optional context.
  root_collection := case target_type when 'project' then 'areas' when 'goal' then 'goals' else 'actions' end;
  select value into root_value from jsonb_array_elements(data -> root_collection) where value ->> 'id'=target_id::text;
  root_bounded := private.bound_context_json(root_value,40000);
  data := jsonb_set(data,array[root_collection],coalesce((select jsonb_agg(value) from jsonb_array_elements(data -> root_collection) where value ->> 'id'<>target_id::text),'[]'::jsonb));
  bounded := private.bound_context_json(data,(root_bounded ->> 'remaining')::integer);
  data := jsonb_set(bounded -> 'value',array[root_collection],jsonb_build_array(root_bounded -> 'value') || (bounded -> 'value' -> root_collection))
    || jsonb_build_object('readLimited',(bounded ->> 'limited')::boolean or (root_bounded ->> 'limited')::boolean);
  if octet_length(data::text)>262144 then raise exception 'context_size_limit'; end if;
  return data;
end;
$$;
revoke all on function public.get_ai_context_data(uuid,text,uuid,boolean,boolean,boolean,boolean,uuid[],text[]) from public, anon;
grant execute on function public.get_ai_context_data(uuid,text,uuid,boolean,boolean,boolean,boolean,uuid[],text[]) to authenticated;
