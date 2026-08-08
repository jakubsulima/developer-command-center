-- Goal-centric read/write model. Legacy tables stay intact for history and export.
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '',
  color text,
  archived_at timestamptz,
  trashed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index areas_workspace_idx on public.areas(workspace_id, name) where archived_at is null and trashed_at is null;

create table public.goal_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  kind text not null check (kind in ('project', 'learning', 'personal', 'maintenance', 'custom')),
  outcome_prompt text not null default 'Co chcesz osiągnąć?',
  criterion_prompt text,
  default_actions jsonb not null default '[]'::jsonb check (jsonb_typeof(default_actions) = 'array'),
  is_system boolean not null default false,
  archived_at timestamptz,
  trashed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_system and workspace_id is null) or (not is_system and workspace_id is not null)),
  unique (id, workspace_id)
);
create index goal_templates_workspace_idx on public.goal_templates(workspace_id, name) where archived_at is null and trashed_at is null;

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  outcome text not null check (char_length(btrim(outcome)) > 0),
  kind text not null default 'custom' check (kind in ('project', 'learning', 'personal', 'maintenance', 'custom')),
  status text not null default 'active' check (status in ('active', 'paused', 'achieved', 'abandoned')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  area_id uuid,
  template_id uuid,
  target_date date,
  archived_at timestamptz,
  trashed_at timestamptz,
  legacy_source text check (legacy_source in ('project', 'learning_goal')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (area_id, workspace_id) references public.areas(id, workspace_id) on delete set null,
  foreign key (template_id, workspace_id) references public.goal_templates(id, workspace_id) on delete set null
);
create index goals_workspace_status_idx on public.goals(workspace_id, status, priority) where archived_at is null and trashed_at is null;
create index goals_area_idx on public.goals(workspace_id, area_id) where archived_at is null and trashed_at is null;

create table public.goal_criteria (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal_id uuid not null,
  title text not null check (char_length(btrim(title)) > 0),
  completed boolean not null default false,
  legacy_source_id uuid,
  position integer not null default 0,
  unique (id, workspace_id),
  foreign key (goal_id, workspace_id) references public.goals(id, workspace_id) on delete cascade
);
create unique index goal_criteria_legacy_idx on public.goal_criteria(workspace_id, legacy_source_id) where legacy_source_id is not null;
create index goal_criteria_goal_idx on public.goal_criteria(workspace_id, goal_id, position);

create table public.recurring_action_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  detail text not null default '',
  goal_id uuid,
  area_id uuid,
  timezone text not null default 'Europe/Warsaw',
  starts_on date not null,
  recurrence_rule jsonb not null,
  missed_policy text not null default 'skip_missed' check (missed_policy in ('skip_missed', 'carry_one')),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  skipped_occurrence_count integer not null default 0 check (skipped_occurrence_count >= 0),
  last_materialized_on date,
  archived_at timestamptz,
  trashed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (goal_id, workspace_id) references public.goals(id, workspace_id) on delete set null,
  foreign key (area_id, workspace_id) references public.areas(id, workspace_id) on delete set null
);
create index recurring_templates_workspace_idx on public.recurring_action_templates(workspace_id, status, starts_on) where archived_at is null and trashed_at is null;

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal_id uuid,
  area_id uuid,
  title text not null check (char_length(btrim(title)) > 0),
  detail text not null default '',
  status text not null default 'ready' check (status in ('ready', 'in_progress', 'blocked', 'completed', 'skipped', 'cancelled')),
  blocker text,
  position integer not null default 0,
  is_next boolean not null default false,
  pinned_to_today boolean not null default false,
  scheduled_for date,
  completed_at timestamptz,
  skipped_at timestamptz,
  cancelled_at timestamptz,
  recurring_template_id uuid,
  occurrence_date date,
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  legacy_source_id uuid,
  archived_at timestamptz,
  trashed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (goal_id, workspace_id) references public.goals(id, workspace_id) on delete set null,
  foreign key (area_id, workspace_id) references public.areas(id, workspace_id) on delete set null,
  foreign key (recurring_template_id, workspace_id) references public.recurring_action_templates(id, workspace_id) on delete set null,
  check ((status = 'blocked' and char_length(btrim(coalesce(blocker, ''))) > 0) or status <> 'blocked'),
  check ((recurring_template_id is null and occurrence_date is null) or (recurring_template_id is not null and occurrence_date is not null))
);
create unique index actions_recurring_occurrence_idx on public.actions(recurring_template_id, occurrence_date) where recurring_template_id is not null;
create unique index actions_legacy_idx on public.actions(workspace_id, legacy_source_id) where legacy_source_id is not null;
create unique index actions_one_next_goal_idx on public.actions(goal_id) where is_next and status in ('ready', 'in_progress');
create index actions_today_idx on public.actions(workspace_id, scheduled_for, pinned_to_today, status) where archived_at is null and trashed_at is null;
create index actions_goal_idx on public.actions(workspace_id, goal_id, position);

create table public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal_id uuid not null,
  action_id uuid,
  knowledge_entity_id uuid,
  kind text not null check (kind in ('note', 'decision', 'result', 'evidence', 'blocker')),
  content text not null check (char_length(btrim(content)) > 0),
  legacy_source text check (legacy_source in ('learning_evidence', 'checkpoint')),
  legacy_source_id uuid,
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (goal_id, workspace_id) references public.goals(id, workspace_id) on delete cascade,
  foreign key (action_id, workspace_id) references public.actions(id, workspace_id) on delete set null,
  foreign key (knowledge_entity_id, workspace_id) references public.entities(id, workspace_id) on delete set null
);
create unique index progress_legacy_idx on public.progress_entries(workspace_id, legacy_source, legacy_source_id) where legacy_source_id is not null;
create index progress_goal_time_idx on public.progress_entries(workspace_id, goal_id, created_at desc);

create table public.knowledge_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  knowledge_entity_id uuid not null,
  goal_id uuid,
  action_id uuid,
  recurring_template_id uuid,
  meaning text not null default 'reference' check (meaning in ('material', 'result', 'decision', 'reference')),
  created_at timestamptz not null default now(),
  foreign key (knowledge_entity_id, workspace_id) references public.entities(id, workspace_id) on delete cascade,
  foreign key (goal_id, workspace_id) references public.goals(id, workspace_id) on delete cascade,
  foreign key (action_id, workspace_id) references public.actions(id, workspace_id) on delete cascade,
  foreign key (recurring_template_id, workspace_id) references public.recurring_action_templates(id, workspace_id) on delete cascade,
  check (num_nonnulls(goal_id, action_id, recurring_template_id) = 1),
  unique nulls not distinct (workspace_id, knowledge_entity_id, goal_id, action_id, recurring_template_id, meaning)
);
create index knowledge_links_knowledge_idx on public.knowledge_links(workspace_id, knowledge_entity_id);

create table public.knowledge_items (
  entity_id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  detail text not null default '',
  source_url text,
  source_inbox_item_id uuid references public.inbox_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, workspace_id),
  foreign key (entity_id, workspace_id) references public.entities(id, workspace_id) on delete cascade
);
create index knowledge_items_workspace_idx on public.knowledge_items(workspace_id, updated_at desc);

insert into public.knowledge_items (entity_id, workspace_id, created_at, updated_at)
select entity.id, entity.workspace_id, entity.created_at, entity.updated_at from public.entities entity
where entity.type in ('note', 'resource', 'decision', 'artifact', 'investigation')
on conflict (entity_id) do nothing;

-- Additive, repeatable backfill. Existing goal-centric edits win on conflict.
insert into public.goals (id, workspace_id, title, outcome, kind, status, priority, area_id, archived_at, trashed_at, legacy_source, created_at, updated_at)
select entity.id, entity.workspace_id, entity.title, project.outcome, 'project',
  case project.status when 'completed' then 'achieved' when 'abandoned' then 'abandoned'
    else case when commitment.status = 'paused' then 'paused' else 'active' end end,
  case when commitment.is_primary then 'high' else 'normal' end,
  case when area.type = 'area' then project.area_id else null end,
  entity.archived_at, entity.trashed_at, 'project', entity.created_at, entity.updated_at
from public.projects project
join public.entities entity on entity.id = project.entity_id and entity.workspace_id = project.workspace_id
left join public.entities area on area.id = project.area_id and area.workspace_id = project.workspace_id
left join lateral (
  select * from public.commitments candidate where candidate.target_entity_id = project.entity_id order by candidate.started_at desc limit 1
) commitment on true
on conflict (id) do nothing;

insert into public.goals (id, workspace_id, title, outcome, kind, status, priority, archived_at, trashed_at, legacy_source, created_at, updated_at)
select entity.id, entity.workspace_id, entity.title, learning.demonstration_criterion, 'learning',
  case learning.status when 'achieved' then 'achieved' when 'abandoned' then 'abandoned' when 'draft' then 'paused' else 'active' end,
  'normal', entity.archived_at, entity.trashed_at, 'learning_goal', entity.created_at, entity.updated_at
from public.learning_goals learning
join public.entities entity on entity.id = learning.entity_id and entity.workspace_id = learning.workspace_id
on conflict (id) do nothing;

insert into public.goal_criteria (id, workspace_id, goal_id, title, completed, legacy_source_id, position)
select requirement.entity_id, requirement.workspace_id, requirement.project_id,
  coalesce(entity.title, requirement.description), requirement.status = 'validated', requirement.entity_id,
  row_number() over (partition by requirement.project_id order by entity.created_at)::integer
from public.requirements requirement
left join public.entities entity on entity.id = requirement.entity_id and entity.workspace_id = requirement.workspace_id
on conflict (id) do nothing;

insert into public.goal_criteria (workspace_id, goal_id, title, completed, legacy_source_id)
select learning.workspace_id, learning.entity_id, learning.demonstration_criterion,
  learning.status = 'achieved', learning.entity_id
from public.learning_goals learning
on conflict (workspace_id, legacy_source_id) where legacy_source_id is not null do nothing;

insert into public.actions (id, workspace_id, goal_id, title, detail, status, blocker, position, is_next, completed_at, legacy_source_id, created_at, updated_at)
select item.entity_id, item.workspace_id, goal.id, entity.title, item.description,
  case item.status when 'open' then 'ready' else item.status::text end,
  item.blocker,
  row_number() over (partition by item.primary_context_entity_id order by entity.created_at)::integer,
  false, item.completed_at, item.entity_id, entity.created_at, entity.updated_at
from public.work_items item
join public.entities entity on entity.id = item.entity_id and entity.workspace_id = item.workspace_id
join public.goals goal on goal.id = item.primary_context_entity_id and goal.workspace_id = item.workspace_id
on conflict (id) do nothing;

with first_ready as (
  select distinct on (goal_id) id from public.actions
  where status in ('ready', 'in_progress') order by goal_id, position, created_at
)
update public.actions action set is_next = true
from first_ready where action.id = first_ready.id and not exists (
  select 1 from public.actions existing where existing.goal_id = action.goal_id and existing.is_next
);

insert into public.progress_entries (id, workspace_id, goal_id, action_id, knowledge_entity_id, kind, content, legacy_source, legacy_source_id, created_at)
select evidence.entity_id, evidence.workspace_id, evidence.learning_goal_id, null, evidence.artifact_entity_id,
  'evidence', concat_ws(E'\n\n', entity.title, nullif(evidence.criterion, ''), nullif(evidence.feedback, '')),
  'learning_evidence', evidence.entity_id, evidence.created_at
from public.learning_evidence evidence
join public.entities entity on entity.id = evidence.entity_id and entity.workspace_id = evidence.workspace_id
on conflict (id) do nothing;

insert into public.progress_entries (id, workspace_id, goal_id, action_id, knowledge_entity_id, kind, content, legacy_source, legacy_source_id, created_at)
select checkpoint.id, checkpoint.workspace_id, action.goal_id, action.id, checkpoint.artifact_entity_id,
  case when checkpoint.blocker is null then 'note' else 'blocker' end,
  concat_ws(E'\n\n', checkpoint.current_state, 'Następne: ' || checkpoint.next_action, checkpoint.blocker, checkpoint.note),
  'checkpoint', checkpoint.id, checkpoint.created_at
from public.context_checkpoints checkpoint
join public.actions action on action.id = checkpoint.work_item_id and action.workspace_id = checkpoint.workspace_id
on conflict (id) do nothing;

-- Public Data API authorization is explicit for every new table.
alter table public.areas enable row level security;
alter table public.goal_templates enable row level security;
alter table public.goals enable row level security;
alter table public.goal_criteria enable row level security;
alter table public.recurring_action_templates enable row level security;
alter table public.actions enable row level security;
alter table public.progress_entries enable row level security;
alter table public.knowledge_links enable row level security;
alter table public.knowledge_items enable row level security;

create policy "members manage areas" on public.areas for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members read system or own goal templates" on public.goal_templates for select to authenticated using (is_system or private.is_workspace_member(workspace_id));
create policy "members create own goal templates" on public.goal_templates for insert to authenticated with check (not is_system and private.is_workspace_member(workspace_id));
create policy "members update own goal templates" on public.goal_templates for update to authenticated using (not is_system and private.is_workspace_member(workspace_id)) with check (not is_system and private.is_workspace_member(workspace_id));
create policy "members delete own goal templates" on public.goal_templates for delete to authenticated using (not is_system and private.is_workspace_member(workspace_id));
create policy "members manage goals" on public.goals for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage goal criteria" on public.goal_criteria for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage recurring templates" on public.recurring_action_templates for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage actions" on public.actions for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage progress" on public.progress_entries for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage knowledge links" on public.knowledge_links for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage knowledge items" on public.knowledge_items for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));

revoke all on table public.areas, public.goal_templates, public.goals, public.goal_criteria,
  public.recurring_action_templates, public.actions, public.progress_entries, public.knowledge_links, public.knowledge_items from anon;
grant select, insert, update, delete on table public.areas, public.goal_templates, public.goals, public.goal_criteria,
  public.recurring_action_templates, public.actions, public.progress_entries, public.knowledge_links, public.knowledge_items to authenticated;

create or replace function public.create_goal_with_action(
  target_workspace_id uuid,
  target_goal_id uuid,
  target_action_id uuid,
  goal_title text,
  goal_outcome text,
  goal_kind text,
  target_area_id uuid,
  first_action_title text,
  first_action_detail text,
  command_idempotency_key uuid
)
returns public.goals
language plpgsql
security invoker
set search_path = ''
as $$
declare created_goal public.goals;
declare existing_goal_id uuid;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  select event.entity_ids[1] into existing_goal_id from public.activity_events event
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key
      and event.command_name = 'create_goal_with_action';
  if existing_goal_id is not null then
    select * into created_goal from public.goals where id = existing_goal_id and workspace_id = target_workspace_id;
    return created_goal;
  end if;
  if btrim(goal_title) = '' then raise exception 'goal_title_required'; end if;
  if btrim(goal_outcome) = '' then raise exception 'goal_outcome_required'; end if;
  if goal_kind not in ('project', 'learning', 'personal', 'maintenance', 'custom') then raise exception 'invalid_goal_kind'; end if;
  if btrim(coalesce(first_action_title, '')) <> '' and target_action_id is null then raise exception 'action_id_required'; end if;

  insert into public.goals (id, workspace_id, title, outcome, kind, area_id)
  values (target_goal_id, target_workspace_id, btrim(goal_title), btrim(goal_outcome), goal_kind, target_area_id)
  returning * into created_goal;
  if btrim(coalesce(first_action_title, '')) <> '' then
    insert into public.actions (id, workspace_id, goal_id, area_id, title, detail, is_next)
    values (target_action_id, target_workspace_id, target_goal_id, target_area_id, btrim(first_action_title), btrim(coalesce(first_action_detail, '')), true);
  end if;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'user', 'create_goal_with_action',
    array_remove(array[target_goal_id, target_action_id], null),
    jsonb_build_object('title', goal_title, 'outcome', goal_outcome), command_idempotency_key);
  return created_goal;
end;
$$;

create or replace function public.materialize_recurring_occurrence(
  target_workspace_id uuid,
  target_template_id uuid,
  target_action_id uuid,
  target_occurrence_date date,
  command_idempotency_key uuid
)
returns public.actions
language plpgsql
security invoker
set search_path = ''
as $$
declare template public.recurring_action_templates;
declare occurrence public.actions;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  select * into template from public.recurring_action_templates
    where id = target_template_id and workspace_id = target_workspace_id and status = 'active' for update;
  if not found then raise exception 'recurring_template_not_active'; end if;
  insert into public.actions (id, workspace_id, goal_id, area_id, title, detail, scheduled_for, recurring_template_id, occurrence_date, checklist)
  values (target_action_id, target_workspace_id, template.goal_id, template.area_id, template.title, template.detail,
    target_occurrence_date, template.id, target_occurrence_date, template.checklist)
  on conflict (recurring_template_id, occurrence_date) where recurring_template_id is not null
  do update set recurring_template_id = excluded.recurring_template_id
  returning * into occurrence;
  update public.recurring_action_templates set last_materialized_on = greatest(last_materialized_on, target_occurrence_date), updated_at = now()
    where id = template.id;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'system', 'materialize_recurring_occurrence', array[occurrence.id],
    jsonb_build_object('templateId', template.id, 'occurrenceDate', target_occurrence_date), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
  return occurrence;
end;
$$;

revoke all on function public.create_goal_with_action(uuid, uuid, uuid, text, text, text, uuid, text, text, uuid),
  public.materialize_recurring_occurrence(uuid, uuid, uuid, date, uuid) from public, anon;
grant execute on function public.create_goal_with_action(uuid, uuid, uuid, text, text, text, uuid, text, text, uuid),
  public.materialize_recurring_occurrence(uuid, uuid, uuid, date, uuid) to authenticated;

create or replace function public.goal_backfill_counts(target_workspace_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when private.is_workspace_member(target_workspace_id) then jsonb_build_object(
    'legacyProjects', (select count(*) from public.projects where workspace_id = target_workspace_id),
    'projectGoals', (select count(*) from public.goals where workspace_id = target_workspace_id and legacy_source = 'project'),
    'legacyLearningGoals', (select count(*) from public.learning_goals where workspace_id = target_workspace_id),
    'learningGoals', (select count(*) from public.goals where workspace_id = target_workspace_id and legacy_source = 'learning_goal'),
    'legacyWorkItems', (select count(*) from public.work_items where workspace_id = target_workspace_id),
    'projectedActions', (select count(*) from public.actions where workspace_id = target_workspace_id and legacy_source_id is not null)
  ) else null end;
$$;
revoke all on function public.goal_backfill_counts(uuid) from public, anon;
grant execute on function public.goal_backfill_counts(uuid) to authenticated;

create or replace function public.create_knowledge_item(
  target_workspace_id uuid,
  target_knowledge_id uuid,
  knowledge_kind text,
  knowledge_title text,
  knowledge_detail text,
  knowledge_source_url text,
  command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare existing_id uuid;
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  select event.entity_ids[1] into existing_id from public.activity_events event
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key and event.command_name = 'create_knowledge_item';
  if existing_id is not null then return existing_id; end if;
  if knowledge_kind not in ('note', 'resource', 'decision', 'artifact', 'investigation') then raise exception 'invalid_knowledge_kind'; end if;
  if btrim(knowledge_title) = '' then raise exception 'knowledge_title_required'; end if;
  insert into public.entities (id, workspace_id, type, title)
  values (target_knowledge_id, target_workspace_id, knowledge_kind::public.entity_type, btrim(knowledge_title));
  insert into public.knowledge_items (entity_id, workspace_id, detail, source_url)
  values (target_knowledge_id, target_workspace_id, btrim(coalesce(knowledge_detail, '')), nullif(btrim(coalesce(knowledge_source_url, '')), ''));
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'user', 'create_knowledge_item', array[target_knowledge_id], jsonb_build_object('kind', knowledge_kind), command_idempotency_key);
  return target_knowledge_id;
end;
$$;
revoke all on function public.create_knowledge_item(uuid, uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.create_knowledge_item(uuid, uuid, text, text, text, text, uuid) to authenticated;

create or replace function public.triage_inbox_intent(
  target_workspace_id uuid,
  target_inbox_item_id uuid,
  target_intent jsonb,
  command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.inbox_items;
declare target_id uuid;
declare goal_id uuid;
declare action_id uuid;
declare knowledge_id uuid;
declare link_id uuid;
declare intent_kind text := target_intent ->> 'kind';
begin
  if not private.is_workspace_member(target_workspace_id) then raise exception 'workspace_access_denied'; end if;
  select event.entity_ids[1] into target_id from public.activity_events event
    where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key
      and event.command_name = 'triage_inbox_intent';
  if target_id is not null then return target_id; end if;
  select * into item from public.inbox_items where id = target_inbox_item_id and workspace_id = target_workspace_id for update;
  if not found then raise exception 'inbox_item_not_found'; end if;
  if item.status <> 'unprocessed' then raise exception 'inbox_item_not_available'; end if;

  if intent_kind = 'goal' then
    goal_id := (target_intent ->> 'goalId')::uuid;
    action_id := nullif(target_intent ->> 'actionId', '')::uuid;
    if btrim(coalesce(target_intent ->> 'title', '')) = '' then raise exception 'goal_title_required'; end if;
    if btrim(coalesce(target_intent ->> 'outcome', '')) = '' then raise exception 'goal_outcome_required'; end if;
    insert into public.goals (id, workspace_id, title, outcome, kind)
    values (goal_id, target_workspace_id, btrim(target_intent ->> 'title'), btrim(target_intent ->> 'outcome'), 'custom');
    if btrim(coalesce(target_intent ->> 'firstActionTitle', '')) <> '' then
      insert into public.actions (id, workspace_id, goal_id, title, is_next)
      values (action_id, target_workspace_id, goal_id, btrim(target_intent ->> 'firstActionTitle'), true);
    end if;
    target_id := goal_id;
  elsif intent_kind = 'action' then
    action_id := (target_intent ->> 'actionId')::uuid;
    goal_id := nullif(target_intent ->> 'goalId', '')::uuid;
    if btrim(coalesce(target_intent ->> 'title', '')) = '' then raise exception 'action_title_required'; end if;
    insert into public.actions (id, workspace_id, goal_id, area_id, title, detail, pinned_to_today)
    values (action_id, target_workspace_id, goal_id, nullif(target_intent ->> 'areaId', '')::uuid,
      btrim(target_intent ->> 'title'), btrim(coalesce(target_intent ->> 'detail', '')),
      coalesce((target_intent ->> 'pinnedToToday')::boolean, false));
    target_id := action_id;
  elsif intent_kind = 'knowledge' then
    knowledge_id := (target_intent ->> 'knowledgeId')::uuid;
    goal_id := nullif(target_intent ->> 'goalId', '')::uuid;
    link_id := nullif(target_intent ->> 'linkId', '')::uuid;
    if btrim(coalesce(target_intent ->> 'title', '')) = '' then raise exception 'knowledge_title_required'; end if;
    if target_intent ->> 'knowledgeKind' not in ('note', 'resource', 'decision', 'artifact', 'investigation') then raise exception 'invalid_knowledge_kind'; end if;
    insert into public.entities (id, workspace_id, type, title)
    values (knowledge_id, target_workspace_id, (target_intent ->> 'knowledgeKind')::public.entity_type, btrim(target_intent ->> 'title'));
    insert into public.knowledge_items (entity_id, workspace_id, detail, source_url, source_inbox_item_id)
    values (knowledge_id, target_workspace_id, btrim(coalesce(target_intent ->> 'detail', '')), nullif(btrim(coalesce(target_intent ->> 'sourceUrl', '')), ''), item.id);
    if goal_id is not null then
      insert into public.knowledge_links (id, workspace_id, knowledge_entity_id, goal_id, meaning)
      values (link_id, target_workspace_id, knowledge_id, goal_id,
        case target_intent ->> 'knowledgeKind' when 'decision' then 'decision' when 'artifact' then 'result' else 'material' end);
    end if;
    target_id := knowledge_id;
  else
    raise exception 'invalid_inbox_intent';
  end if;

  update public.inbox_items set status = 'resolved', resolved_at = now(), snoozed_until = null where id = item.id;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'user', 'triage_inbox_intent', array[target_id],
    jsonb_build_object('inboxItemId', item.id, 'intent', intent_kind), command_idempotency_key);
  return target_id;
end;
$$;
revoke all on function public.triage_inbox_intent(uuid, uuid, jsonb, uuid) from public, anon;
grant execute on function public.triage_inbox_intent(uuid, uuid, jsonb, uuid) to authenticated;
