-- Match the supporting index order to the composite foreign key so deletes
-- from knowledge_items can efficiently check dependent evidence links.
drop index public.knowledge_links_target_knowledge_idx;

create index knowledge_links_target_knowledge_idx
  on public.knowledge_links(target_knowledge_entity_id, workspace_id)
  where target_knowledge_entity_id is not null;
