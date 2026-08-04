create unique index if not exists activity_events_idempotency_idx
on public.activity_events(workspace_id, correlation_id);

create policy "members create activity" on public.activity_events
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and actor_user_id = (select auth.uid())
);
grant insert on table public.activity_events to authenticated;

create or replace function public.create_shaped_project(
  target_workspace_id uuid,
  project_title text,
  project_outcome text,
  project_technology text,
  first_work_item_title text,
  first_work_item_description text,
  effort_budget_minutes integer,
  command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  project_entity_id uuid := gen_random_uuid();
  work_item_entity_id uuid := gen_random_uuid();
  should_be_primary boolean;
  active_count integer;
  workspace_limit integer;
  existing_project_id uuid;
begin
  if not private.is_workspace_member(target_workspace_id) then
    raise exception 'workspace_access_denied';
  end if;

  select event.entity_ids[1] into existing_project_id
  from public.activity_events event
  where event.workspace_id = target_workspace_id
    and event.correlation_id = command_idempotency_key
    and event.command_name = 'create_shaped_project';
  if existing_project_id is not null then return existing_project_id; end if;

  if btrim(project_title) = '' then raise exception 'project_title_required'; end if;
  if btrim(project_outcome) = '' then raise exception 'project_outcome_required'; end if;
  if btrim(first_work_item_title) = '' then raise exception 'work_item_title_required'; end if;
  if effort_budget_minutes is not null and effort_budget_minutes <= 0 then raise exception 'invalid_effort_budget'; end if;

  select count(commitment.id), max(workspace.wip_limit)
  into active_count, workspace_limit
  from public.workspaces workspace
  left join public.commitments commitment
    on commitment.workspace_id = workspace.id and commitment.status = 'active'
  where workspace.id = target_workspace_id;

  if active_count >= workspace_limit then raise exception 'wip_limit_reached'; end if;
  should_be_primary := active_count = 0;

  insert into public.entities (id, workspace_id, type, title)
  values
    (project_entity_id, target_workspace_id, 'project', btrim(project_title)),
    (work_item_entity_id, target_workspace_id, 'work_item', btrim(first_work_item_title));

  insert into public.projects (entity_id, workspace_id, outcome, constraints_md, status)
  values (
    project_entity_id,
    target_workspace_id,
    btrim(project_outcome),
    case when btrim(coalesce(project_technology, '')) = '' then '' else 'Technologie: ' || btrim(project_technology) end,
    'shaped'
  );

  insert into public.work_items (entity_id, workspace_id, primary_context_entity_id, description, status)
  values (work_item_entity_id, target_workspace_id, project_entity_id, btrim(coalesce(first_work_item_description, '')), 'open');

  insert into public.commitments (workspace_id, target_entity_id, status, is_primary, effort_budget_minutes)
  values (target_workspace_id, project_entity_id, 'active', should_be_primary, effort_budget_minutes);

  insert into public.activity_events (
    workspace_id,
    actor_user_id,
    source,
    command_name,
    entity_ids,
    summary_diff,
    correlation_id
  ) values (
    target_workspace_id,
    (select auth.uid()),
    'user',
    'create_shaped_project',
    array[project_entity_id, work_item_entity_id],
    jsonb_build_object('project', project_title, 'outcome', project_outcome, 'firstWorkItem', first_work_item_title),
    command_idempotency_key
  );

  return project_entity_id;
end;
$$;

revoke all on function public.create_shaped_project(uuid, text, text, text, text, text, integer, uuid) from public, anon;
grant execute on function public.create_shaped_project(uuid, text, text, text, text, text, integer, uuid) to authenticated;
