-- Projects are persistent contexts backed by areas. Knowledge may belong directly
-- to a Project instead of requiring an intermediate Goal or Action.
insert into public.areas (id, workspace_id, name, description, archived_at, trashed_at, created_at, updated_at)
select entity.id, entity.workspace_id, entity.title, project.outcome,
  entity.archived_at, entity.trashed_at, entity.created_at, entity.updated_at
from public.projects project
join public.entities entity
  on entity.id = project.entity_id and entity.workspace_id = project.workspace_id
on conflict (id) do nothing;

update public.goals
set area_id = id, updated_at = now()
where legacy_source = 'project' and area_id is distinct from id;

alter table public.knowledge_links
  add column area_id uuid;

alter table public.knowledge_links
  add constraint knowledge_links_area_workspace_fkey
  foreign key (area_id, workspace_id)
  references public.areas(id, workspace_id)
  on delete cascade;

alter table public.knowledge_links
  drop constraint knowledge_links_check;

alter table public.knowledge_links
  add constraint knowledge_links_single_target_check
  check (num_nonnulls(area_id, goal_id, action_id, recurring_template_id) = 1);

alter table public.knowledge_links
  drop constraint knowledge_links_workspace_id_knowledge_entity_id_goal_id_ac_key;

create unique index knowledge_links_unique_target_idx
  on public.knowledge_links (
    workspace_id,
    knowledge_entity_id,
    area_id,
    goal_id,
    action_id,
    recurring_template_id,
    meaning
  ) nulls not distinct;

create index knowledge_links_area_idx
  on public.knowledge_links(workspace_id, area_id)
  where area_id is not null;
