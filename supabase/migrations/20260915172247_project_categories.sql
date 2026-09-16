-- Categories replace the presentation of project hierarchy. Every project is retained.
create table public.project_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  color text not null default '#60a5fa' check (color ~ '^#[0-9a-fA-F]{6}$')
);
create unique index project_categories_name_idx on public.project_categories(workspace_id, lower(btrim(name)));
alter table public.project_categories enable row level security;
create policy "members manage project categories" on public.project_categories for all to authenticated
using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
grant select, insert, update, delete on public.project_categories to authenticated;
alter table public.areas add column category_ids uuid[] not null default '{}';
create index areas_category_ids_idx on public.areas using gin(category_ids);

-- Defaults for existing workspaces, including empty groups ready to use.
insert into public.project_categories(workspace_id, name, color)
select w.id, sample.name, sample.color from public.workspaces w cross join
(values ('Praca', '#60a5fa'), ('Nauka', '#a78bfa'), ('Projekty osobiste', '#34d399'), ('AI', '#fbbf24')) sample(name,color);

-- Preserve previous grouping as category memberships; do not remove parent projects.
insert into public.project_categories(workspace_id, name, color)
select distinct a.workspace_id, left(btrim(a.name),100), '#60a5fa' from public.areas a
where exists (select 1 from public.areas child where child.parent_project_id = a.id)
on conflict do nothing;
update public.areas a set category_ids = array(
  select c.id from public.project_categories c where c.workspace_id = a.workspace_id and (
    exists (select 1 from public.areas parent where parent.id = a.parent_project_id and lower(left(btrim(parent.name),100)) = lower(c.name))
    or (lower(left(btrim(a.name),100)) = lower(c.name) and exists (select 1 from public.areas child where child.parent_project_id = a.id))
  )
);
update public.areas set parent_project_id = null where parent_project_id is not null;

create function private.validate_project_categories() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.project_categories c where c.workspace_id = new.workspace_id and c.id = any(new.category_ids) order by c.id for key share;
  if exists (select 1 from unnest(new.category_ids) selected(category_id) where not exists (select 1 from public.project_categories c where c.id = selected.category_id and c.workspace_id = new.workspace_id)) then
    raise exception 'Wybrana kategoria jest niedostępna.';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_project_categories() from public, anon, authenticated;
create trigger validate_project_categories before insert or update of category_ids, workspace_id on public.areas for each row execute function private.validate_project_categories();
create function private.detach_project_category() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.areas set category_ids = array_remove(category_ids, old.id) where workspace_id = old.workspace_id and old.id = any(category_ids);
  return old;
end;
$$;
revoke all on function private.detach_project_category() from public, anon, authenticated;
create trigger detach_project_category before delete on public.project_categories for each row execute function private.detach_project_category();

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
  'projectCategories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color) order by c.name) from public.project_categories c where c.workspace_id = w.id), '[]'::jsonb),
  'areas', coalesce((select jsonb_agg(jsonb_build_object(
    'categoryIds', to_jsonb(area.category_ids), 'parentProjectId', area.parent_project_id, 'id', area.id, 'name', area.name, 'description', area.description,
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

-- A category cannot be moved to another workspace while projects reference it.
create function private.keep_category_workspace() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.workspace_id is distinct from old.workspace_id or new.id is distinct from old.id then
    raise exception 'Nie można przenieść kategorii do innej przestrzeni pracy.';
  end if;
  return new;
end;
$$;
revoke all on function private.keep_category_workspace() from public, anon, authenticated;
create trigger keep_category_workspace before update on public.project_categories for each row execute function private.keep_category_workspace();
