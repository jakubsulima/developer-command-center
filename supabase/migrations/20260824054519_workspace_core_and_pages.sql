-- Read model for the active Workspace. All functions are SECURITY INVOKER so
-- the existing row-level policies remain the authorization boundary.
create index if not exists inbox_page_cursor_idx
  on public.inbox_items (workspace_id, created_at, id);
create index if not exists knowledge_page_cursor_idx
  on public.knowledge_items (workspace_id, updated_at, entity_id);
create index if not exists progress_page_cursor_idx
  on public.progress_entries (workspace_id, goal_id, created_at, id);
create index if not exists completed_actions_page_cursor_idx
  on public.actions (workspace_id, completed_at, id)
  where status = 'completed';
create index if not exists reviews_page_cursor_idx
  on public.reviews (workspace_id, completed_at, id);

create or replace function public.get_workspace_core(target_user_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
with membership as (
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = target_user_id
    and wm.user_id = (select auth.uid())
  limit 1
)
select jsonb_build_object(
  'workspaceId', w.id,
  'workspaceTimezone', w.timezone,
  'areas', coalesce((select jsonb_agg(jsonb_build_object(
    'id', area.id, 'name', area.name, 'description', area.description,
    'color', area.color, 'visibility', case when area.trashed_at is not null then 'trashed' when area.archived_at is not null then 'archived' else 'active' end,
    'createdAt', area.created_at, 'updatedAt', area.updated_at
  ) order by area.name, area.id) from public.areas area where area.workspace_id = w.id and area.archived_at is null and area.trashed_at is null), '[]'::jsonb),
  'goalTemplates', coalesce((select jsonb_agg(jsonb_build_object(
    'id', template.id, 'name', template.name, 'kind', template.kind,
    'outcomePrompt', template.outcome_prompt, 'criterionPrompt', template.criterion_prompt,
    'defaultActions', template.default_actions, 'system', template.is_system,
    'visibility', case when template.trashed_at is not null then 'trashed' when template.archived_at is not null then 'archived' else 'active' end,
    'createdAt', template.created_at, 'updatedAt', template.updated_at
  ) order by template.is_system desc, template.name, template.id) from public.goal_templates template where (template.workspace_id = w.id or template.is_system) and template.archived_at is null and template.trashed_at is null), '[]'::jsonb),
  'goals', coalesce((select jsonb_agg(jsonb_build_object(
    'id', goal.id, 'version', goal.version, 'title', goal.title, 'outcome', goal.outcome, 'kind', goal.kind,
    'status', goal.status, 'visibility', case when goal.trashed_at is not null then 'trashed' when goal.archived_at is not null then 'archived' else 'active' end,
    'priority', goal.priority, 'areaId', goal.area_id, 'templateId', goal.template_id,
    'targetDate', goal.target_date, 'legacySource', goal.legacy_source,
    'createdAt', goal.created_at, 'updatedAt', goal.updated_at
  ) order by goal.created_at, goal.id) from public.goals goal where goal.workspace_id = w.id and goal.trashed_at is null), '[]'::jsonb),
  'goalCriteria', coalesce((select jsonb_agg(jsonb_build_object(
    'id', criterion.id, 'goalId', criterion.goal_id, 'title', criterion.title,
    'completed', criterion.completed, 'legacySourceId', criterion.legacy_source_id
  ) order by criterion.goal_id, criterion.position, criterion.id) from public.goal_criteria criterion where criterion.workspace_id = w.id), '[]'::jsonb),
  'actions', coalesce((select jsonb_agg(jsonb_build_object(
    'id', action.id, 'version', action.version, 'goalId', action.goal_id, 'areaId', action.area_id,
    'title', action.title, 'detail', action.detail, 'status', action.status, 'blocker', action.blocker,
    'position', action.position, 'isNext', action.is_next, 'pinnedToToday', action.pinned_to_today,
    'scheduledFor', action.scheduled_for, 'completedAt', action.completed_at, 'skippedAt', action.skipped_at,
    'cancelledAt', action.cancelled_at, 'recurringTemplateId', action.recurring_template_id,
    'occurrenceDate', action.occurrence_date, 'checklist', action.checklist,
    'legacySourceId', action.legacy_source_id, 'createdAt', action.created_at, 'updatedAt', action.updated_at
  ) order by action.position, action.id) from public.actions action where action.workspace_id = w.id and action.trashed_at is null and action.archived_at is null and action.status not in ('completed', 'cancelled', 'skipped')), '[]'::jsonb),
  'projects', coalesce((select jsonb_agg(jsonb_build_object(
    'id', entity.id, 'name', entity.title, 'initials', upper(left(regexp_replace(entity.title, '[^[:alnum:]]+', ' ', 'g'), 2)),
    'color', 'violet', 'technology', coalesce(nullif(regexp_replace(project.constraints_md, '.*[Tt]echnologie:\\s*([^\\n]+).*', '\\1'), project.constraints_md), 'Projekt developerski'),
    'outcome', project.outcome,
    'status', case when coalesce(commitment.status::text, '') in ('paused', 'released') or project.status = 'draft' then 'Gotowy do decyzji' when exists (select 1 from public.work_items item where item.primary_context_entity_id = entity.id and item.status = 'blocked') then 'Zagrożony' else 'W trakcie' end,
    'domainStatus', project.status, 'commitmentStatus', commitment.status,
    'nextStep', coalesce((select next_entity.title from public.work_items next_item join public.entities next_entity on next_entity.id = next_item.entity_id where next_item.primary_context_entity_id = entity.id and next_item.status not in ('completed', 'cancelled') order by next_entity.created_at, next_entity.id limit 1), 'Brak następnego kroku'),
    'blocker', (select item.blocker from public.work_items item where item.primary_context_entity_id = entity.id and item.status = 'blocked' order by item.entity_id limit 1),
    'primary', coalesce(commitment.is_primary, false), 'effortBudgetMinutes', commitment.effort_budget_minutes, 'usedMinutes', 0,
    'requirements', coalesce((select jsonb_agg(jsonb_build_object('id', requirement.entity_id, 'title', requirement.description, 'status', requirement.status) order by requirement.entity_id) from public.requirements requirement where requirement.project_id = entity.id), '[]'::jsonb),
    'workItems', coalesce((select jsonb_agg(jsonb_build_object('id', item.entity_id, 'title', item_entity.title, 'detail', item.description, 'completed', item.status = 'completed', 'status', item.status, 'blocker', item.blocker) order by item_entity.created_at, item.entity_id) from public.work_items item join public.entities item_entity on item_entity.id = item.entity_id where item.primary_context_entity_id = entity.id), '[]'::jsonb)
  ) order by entity.created_at, entity.id) from public.entities entity join public.projects project on project.entity_id = entity.id left join lateral (select c.* from public.commitments c where c.target_entity_id = entity.id order by c.started_at desc limit 1) commitment on true where entity.workspace_id = w.id and entity.type = 'project' and entity.trashed_at is null), '[]'::jsonb),
  'recurringActionTemplates', coalesce((select jsonb_agg(jsonb_build_object(
    'id', template.id, 'title', template.title, 'detail', template.detail, 'goalId', template.goal_id, 'areaId', template.area_id,
    'timezone', template.timezone, 'startsOn', template.starts_on, 'rule', template.recurrence_rule, 'missedPolicy', template.missed_policy,
    'status', template.status, 'checklist', template.checklist, 'lastMaterializedOn', template.last_materialized_on,
    'skippedOccurrenceCount', template.skipped_occurrence_count, 'createdAt', template.created_at, 'updatedAt', template.updated_at
  ) order by template.starts_on, template.id) from public.recurring_action_templates template where template.workspace_id = w.id and template.trashed_at is null), '[]'::jsonb),
  'knowledgeLinks', coalesce((select jsonb_agg(jsonb_build_object(
    'id', link.id, 'knowledgeItemId', link.knowledge_entity_id, 'targetKnowledgeItemId', link.target_knowledge_entity_id,
    'areaId', link.area_id, 'goalId', link.goal_id, 'actionId', link.action_id, 'recurringTemplateId', link.recurring_template_id,
    'meaning', link.meaning, 'createdAt', link.created_at
  ) order by link.created_at, link.id) from public.knowledge_links link where link.workspace_id = w.id), '[]'::jsonb),
  'counts', jsonb_build_object(
    'inbox', (select count(*) from public.inbox_items item where item.workspace_id = w.id and item.status = 'unprocessed'),
    'knowledge', (select count(*) from public.entities entity where entity.workspace_id = w.id and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation') and entity.archived_at is null and entity.trashed_at is null),
    'openActions', (select count(*) from public.actions action where action.workspace_id = w.id and action.status not in ('completed', 'cancelled', 'skipped') and action.archived_at is null and action.trashed_at is null),
    'start', (select count(*) from public.actions action where action.workspace_id = w.id and action.pinned_to_today and action.status not in ('completed', 'cancelled', 'skipped') and action.archived_at is null and action.trashed_at is null)
  ),
  'weeklySummary', jsonb_build_object(
    'completedActions', (select count(*) from public.actions action where action.workspace_id = w.id and action.status = 'completed' and action.completed_at >= date_trunc('week', now())),
    'focusMinutes', coalesce((select round(sum(extract(epoch from (session.ended_at - session.started_at)) / 60))::integer from public.focus_sessions session where session.workspace_id = w.id and session.ended_at >= date_trunc('week', now())), 0),
    'knowledgeAdded', (select count(*) from public.knowledge_items item where item.workspace_id = w.id and item.created_at >= date_trunc('week', now())),
    'progressUpdates', (select count(*) from public.progress_entries entry where entry.workspace_id = w.id and entry.created_at >= date_trunc('week', now())),
    'recentReviews', coalesce((select jsonb_agg(jsonb_build_object('id', review.id, 'type', review.type, 'templateVersion', review.template_version, 'answers', review.answers, 'summary', review.summary, 'completedAt', review.completed_at) order by review.completed_at desc) from (select * from public.reviews review where review.workspace_id = w.id order by review.completed_at desc limit 4) review), '[]'::jsonb)
  )
)
from public.workspaces w
join membership on membership.workspace_id = w.id;
$$;

create or replace function public.get_inbox_page(target_workspace_id uuid, page_size integer default 50, cursor_sort_value text default null, cursor_id uuid default null)
returns jsonb language sql stable security invoker as $$
with ranked as (
  select item.*, row_number() over (order by item.created_at, item.id) as row_no
  from public.inbox_items item
  where item.workspace_id = target_workspace_id and private.is_workspace_member(item.workspace_id)
    and (cursor_sort_value is null or (item.created_at::text, item.id::text) > (cursor_sort_value, cursor_id::text))
  order by item.created_at, item.id
  limit greatest(1, least(coalesce(page_size, 50), 100)) + 1
), visible as (select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 50), 100)))
select jsonb_build_object('items', coalesce((select jsonb_agg(jsonb_build_object('id', item.id, 'kind', item.kind, 'content', item.raw_content, 'createdAt', item.created_at, 'status', item.status, 'snoozedUntil', item.snoozed_until, 'discardedAt', item.discarded_at) order by item.created_at, item.id) from visible item), '[]'::jsonb), 'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 50), 100)) + 1) then (select jsonb_build_object('sortValue', item.created_at::text, 'id', item.id) from visible item order by item.created_at desc, item.id desc limit 1) else null end);
$$;

create or replace function public.get_knowledge_page(target_workspace_id uuid, page_size integer default 50, cursor_sort_value text default null, cursor_id uuid default null)
returns jsonb language sql stable security invoker as $$
with ranked as (
  select entity.id, entity.version, entity.type, entity.title, content.detail, content.source_url, content.source_inbox_item_id, entity.archived_at, entity.trashed_at, content.created_at, content.updated_at, row_number() over (order by content.updated_at, entity.id) as row_no
  from public.entities entity join public.knowledge_items content on content.entity_id = entity.id and content.workspace_id = entity.workspace_id
  where entity.workspace_id = target_workspace_id and private.is_workspace_member(entity.workspace_id) and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation')
    and (cursor_sort_value is null or (content.updated_at::text, entity.id::text) > (cursor_sort_value, cursor_id::text))
  order by content.updated_at, entity.id
  limit greatest(1, least(coalesce(page_size, 50), 100)) + 1
), visible as (select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 50), 100)))
select jsonb_build_object('items', coalesce((select jsonb_agg(jsonb_build_object('id', item.id, 'version', item.version, 'type', item.type, 'title', item.title, 'detail', item.detail, 'sourceUrl', item.source_url, 'sourceInboxItemId', item.source_inbox_item_id, 'archivedAt', item.archived_at, 'trashedAt', item.trashed_at, 'createdAt', item.created_at, 'updatedAt', item.updated_at) order by item.updated_at, item.id) from visible item), '[]'::jsonb), 'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 50), 100)) + 1) then (select jsonb_build_object('sortValue', item.updated_at::text, 'id', item.id) from visible item order by item.updated_at desc, item.id desc limit 1) else null end);
$$;

create or replace function public.get_goal_progress_page(target_workspace_id uuid, target_goal_id uuid default null, page_size integer default 25, cursor_sort_value text default null, cursor_id uuid default null)
returns jsonb language sql stable security invoker as $$
with ranked as (
  select entry.*, row_number() over (order by entry.created_at, entry.id) as row_no
  from public.progress_entries entry
  where entry.workspace_id = target_workspace_id and private.is_workspace_member(entry.workspace_id) and (target_goal_id is null or entry.goal_id = target_goal_id)
    and (cursor_sort_value is null or (entry.created_at::text, entry.id::text) > (cursor_sort_value, cursor_id::text))
  order by entry.created_at, entry.id
  limit greatest(1, least(coalesce(page_size, 25), 100)) + 1
), visible as (select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 25), 100)))
select jsonb_build_object('items', coalesce((select jsonb_agg(jsonb_build_object('id', entry.id, 'goalId', entry.goal_id, 'actionId', entry.action_id, 'knowledgeItemId', entry.knowledge_entity_id, 'kind', entry.kind, 'content', entry.content, 'legacySource', entry.legacy_source, 'legacySourceId', entry.legacy_source_id, 'createdAt', entry.created_at) order by entry.created_at, entry.id) from visible entry), '[]'::jsonb), 'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 25), 100)) + 1) then (select jsonb_build_object('sortValue', entry.created_at::text, 'id', entry.id) from visible entry order by entry.created_at desc, entry.id desc limit 1) else null end);
$$;

create or replace function public.get_completed_actions_page(target_workspace_id uuid, page_size integer default 50, cursor_sort_value text default null, cursor_id uuid default null)
returns jsonb language sql stable security invoker as $$
with ranked as (
  select action.*, row_number() over (order by action.completed_at, action.id) as row_no
  from public.actions action
  where action.workspace_id = target_workspace_id and private.is_workspace_member(action.workspace_id) and action.status = 'completed'
    and (cursor_sort_value is null or (action.completed_at::text, action.id::text) > (cursor_sort_value, cursor_id::text))
  order by action.completed_at, action.id
  limit greatest(1, least(coalesce(page_size, 50), 100)) + 1
), visible as (select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 50), 100)))
select jsonb_build_object('items', coalesce((select jsonb_agg(jsonb_build_object('id', action.id, 'version', action.version, 'goalId', action.goal_id, 'areaId', action.area_id, 'title', action.title, 'detail', action.detail, 'status', action.status, 'blocker', action.blocker, 'position', action.position, 'isNext', action.is_next, 'pinnedToToday', action.pinned_to_today, 'scheduledFor', action.scheduled_for, 'completedAt', action.completed_at, 'skippedAt', action.skipped_at, 'cancelledAt', action.cancelled_at, 'recurringTemplateId', action.recurring_template_id, 'occurrenceDate', action.occurrence_date, 'checklist', action.checklist, 'legacySourceId', action.legacy_source_id, 'createdAt', action.created_at, 'updatedAt', action.updated_at) order by action.completed_at, action.id) from visible action), '[]'::jsonb), 'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 50), 100)) + 1) then (select jsonb_build_object('sortValue', action.completed_at::text, 'id', action.id) from visible action order by action.completed_at desc, action.id desc limit 1) else null end);
$$;

create or replace function public.get_reviews_page(target_workspace_id uuid, page_size integer default 20, cursor_sort_value text default null, cursor_id uuid default null)
returns jsonb language sql stable security invoker as $$
with ranked as (
  select review.*, row_number() over (order by review.completed_at, review.id) as row_no
  from public.reviews review
  where review.workspace_id = target_workspace_id and private.is_workspace_member(review.workspace_id)
    and (cursor_sort_value is null or (review.completed_at::text, review.id::text) > (cursor_sort_value, cursor_id::text))
  order by review.completed_at, review.id
  limit greatest(1, least(coalesce(page_size, 20), 100)) + 1
), visible as (select * from ranked where row_no <= greatest(1, least(coalesce(page_size, 20), 100)))
select jsonb_build_object('items', coalesce((select jsonb_agg(jsonb_build_object('id', review.id, 'type', review.type, 'templateVersion', review.template_version, 'answers', review.answers, 'summary', review.summary, 'completedAt', review.completed_at) order by review.completed_at, review.id) from visible review), '[]'::jsonb), 'nextCursor', case when exists (select 1 from ranked where row_no = greatest(1, least(coalesce(page_size, 20), 100)) + 1) then (select jsonb_build_object('sortValue', review.completed_at::text, 'id', review.id) from visible review order by review.completed_at desc, review.id desc limit 1) else null end);
$$;

create or replace function public.get_knowledge_item(target_item_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
select jsonb_build_object(
  'id', entity.id, 'version', entity.version, 'type', entity.type, 'title', entity.title, 'detail', content.detail,
  'sourceUrl', content.source_url, 'sourceInboxItemId', content.source_inbox_item_id,
  'archivedAt', entity.archived_at, 'trashedAt', entity.trashed_at,
  'createdAt', content.created_at, 'updatedAt', content.updated_at
)
from public.entities entity
join public.knowledge_items content on content.entity_id = entity.id and content.workspace_id = entity.workspace_id
where entity.id = target_item_id
  and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation')
  and private.is_workspace_member(entity.workspace_id);
$$;

create or replace function public.get_legacy_focus_session(target_session_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
select case when session.id is null then null else jsonb_build_object(
  'id', session.id, 'projectId', work_item.primary_context_entity_id, 'workItemId', session.work_item_id,
  'startedAt', session.started_at, 'endedAt', session.ended_at, 'endReason', session.end_reason, 'scratchpad', session.scratchpad
) end
from public.focus_sessions session
join public.work_items work_item on work_item.entity_id = session.work_item_id
where session.id = target_session_id and private.is_workspace_member(session.workspace_id);
$$;

create or replace function public.search_workspace(search_query text, result_limit integer default 20)
returns jsonb
language sql
stable
security invoker
as $$
with member_workspaces as (select wm.workspace_id from public.workspace_members wm where wm.user_id = (select auth.uid())), results as (
  select entity.id, 'goal'::text as type, entity.title, goal.outcome as detail, '/goals/' || entity.id::text as route from public.goals goal join public.entities entity on entity.id = goal.id where goal.workspace_id in (select workspace_id from member_workspaces) and (goal.title ilike '%' || search_query || '%' or goal.outcome ilike '%' || search_query || '%')
  union all select action.id, 'action', action.title, action.detail, '/actions/' || action.id::text from public.actions action where action.workspace_id in (select workspace_id from member_workspaces) and (action.title ilike '%' || search_query || '%' or action.detail ilike '%' || search_query || '%')
  union all select entity.id, 'knowledge', entity.title, content.detail, '/knowledge/' || entity.id::text from public.entities entity join public.knowledge_items content on content.entity_id = entity.id where entity.workspace_id in (select workspace_id from member_workspaces) and entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation') and (entity.title ilike '%' || search_query || '%' or content.detail ilike '%' || search_query || '%')
  union all select entity.id, 'project', entity.title, project.outcome, '/projects/' || entity.id::text from public.entities entity join public.projects project on project.entity_id = entity.id where entity.workspace_id in (select workspace_id from member_workspaces) and (entity.title ilike '%' || search_query || '%' or project.outcome ilike '%' || search_query || '%')
  union all select item.id, 'inbox', item.raw_content, null, '/knowledge?section=inbox&item=' || item.id::text from public.inbox_items item where item.workspace_id in (select workspace_id from member_workspaces) and item.raw_content ilike '%' || search_query || '%'
), limited as (
  select * from results where length(btrim(search_query)) >= 2 order by title, id limit greatest(1, least(coalesce(result_limit, 20), 20))
)
select coalesce(jsonb_agg(jsonb_build_object('id', limited.id, 'type', limited.type, 'title', limited.title, 'detail', limited.detail, 'route', limited.route) order by limited.title, limited.id), '[]'::jsonb) from limited;
$$;

revoke all on function public.get_workspace_core(uuid) from public, anon;
grant execute on function public.get_workspace_core(uuid) to authenticated;
revoke all on function public.get_inbox_page(uuid, integer, text, uuid) from public, anon;
grant execute on function public.get_inbox_page(uuid, integer, text, uuid) to authenticated;
revoke all on function public.get_knowledge_page(uuid, integer, text, uuid) from public, anon;
grant execute on function public.get_knowledge_page(uuid, integer, text, uuid) to authenticated;
revoke all on function public.get_goal_progress_page(uuid, uuid, integer, text, uuid) from public, anon;
grant execute on function public.get_goal_progress_page(uuid, uuid, integer, text, uuid) to authenticated;
revoke all on function public.get_completed_actions_page(uuid, integer, text, uuid) from public, anon;
grant execute on function public.get_completed_actions_page(uuid, integer, text, uuid) to authenticated;
revoke all on function public.get_reviews_page(uuid, integer, text, uuid) from public, anon;
grant execute on function public.get_reviews_page(uuid, integer, text, uuid) to authenticated;
revoke all on function public.get_knowledge_item(uuid) from public, anon;
grant execute on function public.get_knowledge_item(uuid) to authenticated;
revoke all on function public.get_legacy_focus_session(uuid) from public, anon;
grant execute on function public.get_legacy_focus_session(uuid) to authenticated;
revoke all on function public.search_workspace(text, integer) from public, anon;
grant execute on function public.search_workspace(text, integer) to authenticated;
