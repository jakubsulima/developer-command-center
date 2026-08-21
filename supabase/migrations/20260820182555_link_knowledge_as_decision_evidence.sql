-- A Knowledge item can support another Knowledge item, for example a source
-- attached to a Decision as confirmation. Existing target types stay intact.
alter table public.knowledge_links
  add column target_knowledge_entity_id uuid;

alter table public.knowledge_links
  add constraint knowledge_links_target_knowledge_workspace_fkey
  foreign key (target_knowledge_entity_id, workspace_id)
  references public.knowledge_items(entity_id, workspace_id)
  on delete cascade;

alter table public.knowledge_links
  drop constraint knowledge_links_single_target_check;

alter table public.knowledge_links
  add constraint knowledge_links_single_target_check
  check (num_nonnulls(target_knowledge_entity_id, area_id, goal_id, action_id, recurring_template_id) = 1);

alter table public.knowledge_links
  add constraint knowledge_links_no_self_reference_check
  check (target_knowledge_entity_id is null or target_knowledge_entity_id <> knowledge_entity_id);

drop index public.knowledge_links_unique_target_idx;

create unique index knowledge_links_unique_target_idx
  on public.knowledge_links (
    workspace_id,
    knowledge_entity_id,
    target_knowledge_entity_id,
    area_id,
    goal_id,
    action_id,
    recurring_template_id,
    meaning
  ) nulls not distinct;

create index knowledge_links_target_knowledge_idx
  on public.knowledge_links(workspace_id, target_knowledge_entity_id)
  where target_knowledge_entity_id is not null;
