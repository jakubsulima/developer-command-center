-- Architecture invariant: an Action can have at most one Knowledge result.
-- The predicate keeps ordinary material/reference/decision links unrestricted.
create unique index if not exists knowledge_links_one_result_per_action_idx
  on public.knowledge_links (workspace_id, action_id)
  where action_id is not null and meaning = 'result';
