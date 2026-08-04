create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.entity_type as enum (
  'area', 'project', 'requirement', 'work_item', 'investigation', 'skill',
  'learning_goal', 'learning_evidence', 'note', 'resource', 'decision', 'artifact'
);
create type public.project_status as enum ('draft', 'shaped', 'validating', 'completed', 'abandoned');
create type public.requirement_status as enum ('proposed', 'accepted', 'validated', 'rejected', 'superseded');
create type public.commitment_status as enum ('active', 'paused', 'released', 'fulfilled');
create type public.work_item_status as enum ('open', 'in_progress', 'blocked', 'completed', 'cancelled');
create type public.inbox_status as enum ('unprocessed', 'snoozed', 'resolved', 'discarded');
create type public.capture_kind as enum ('text', 'voice', 'link', 'file');
create type public.session_end_reason as enum ('paused', 'work_item_completed', 'stopped', 'interrupted');
create type public.learning_result as enum ('supports', 'reveals_gap', 'inconclusive');
create type public.review_type as enum ('daily', 'weekly');
create type public.ai_proposal_status as enum ('pending', 'approved', 'rejected', 'expired', 'superseded');
create type public.ai_execution_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  wip_limit smallint not null default 3 check (wip_limit between 1 and 10),
  timezone text not null default 'Europe/Warsaw',
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  pending_deletion_at timestamptz
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.workspace_members membership
      where membership.workspace_id = target_workspace_id
        and membership.user_id = (select auth.uid())
    );
$$;
revoke all on function private.is_workspace_member(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;

create or replace function private.bootstrap_user_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare new_workspace_id uuid;
begin
  insert into public.workspaces (name)
  values (coalesce(nullif(new.raw_user_meta_data ->> 'workspace_name', ''), 'Osobiste'))
  returning id into new_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');
  return new;
end;
$$;
revoke all on function private.bootstrap_user_workspace() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.bootstrap_user_workspace();

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type public.entity_type not null,
  title text not null check (char_length(title) between 1 and 300),
  archived_at timestamptz,
  trashed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entities_workspace_type_idx on public.entities(workspace_id, type) where archived_at is null and trashed_at is null;

create table public.projects (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  area_id uuid references public.entities(id) on delete set null,
  outcome text not null check (char_length(outcome) > 0),
  constraints_md text not null default '',
  status public.project_status not null default 'draft',
  completed_at timestamptz
);

create table public.requirements (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(entity_id) on delete cascade,
  description text not null,
  status public.requirement_status not null default 'proposed',
  validation_evidence_entity_id uuid references public.entities(id) on delete set null
);
create index requirements_project_idx on public.requirements(project_id, status);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target_entity_id uuid not null references public.entities(id) on delete cascade,
  status public.commitment_status not null default 'active',
  is_primary boolean not null default false,
  effort_budget_minutes integer check (effort_budget_minutes > 0),
  effort_budget_sessions integer check (effort_budget_sessions > 0),
  override_reason text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (not (effort_budget_minutes is not null and effort_budget_sessions is not null)),
  check (status = 'active' or not is_primary)
);
create unique index commitments_one_open_target_idx on public.commitments(target_entity_id) where status in ('active', 'paused');
create unique index commitments_one_primary_workspace_idx on public.commitments(workspace_id) where status = 'active' and is_primary;

create table public.work_items (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  primary_context_entity_id uuid not null references public.entities(id) on delete restrict,
  description text not null default '',
  status public.work_item_status not null default 'open',
  blocker text,
  completed_at timestamptz
);
create index work_items_context_idx on public.work_items(primary_context_entity_id, status);

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind public.capture_kind not null default 'text',
  raw_content text not null check (char_length(raw_content) > 0),
  source_url text,
  status public.inbox_status not null default 'unprocessed',
  idempotency_key uuid not null,
  sync_state text not null default 'synced' check (sync_state in ('local', 'syncing', 'synced', 'conflict', 'failed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (workspace_id, idempotency_key)
);
create index inbox_unprocessed_idx on public.inbox_items(workspace_id, created_at desc) where status = 'unprocessed';

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  work_item_id uuid not null references public.work_items(entity_id) on delete restrict,
  user_id uuid not null references auth.users(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason public.session_end_reason,
  scratchpad text not null default '',
  invalidated_at timestamptz,
  idempotency_key uuid not null,
  unique (workspace_id, idempotency_key),
  check ((ended_at is null and end_reason is null) or (ended_at is not null and end_reason is not null))
);
create unique index focus_sessions_one_running_idx on public.focus_sessions(workspace_id, user_id) where ended_at is null and invalidated_at is null;

create table public.context_checkpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  focus_session_id uuid not null unique references public.focus_sessions(id) on delete cascade,
  work_item_id uuid not null references public.work_items(entity_id) on delete restrict,
  current_state text not null check (char_length(current_state) > 0),
  next_action text not null check (char_length(next_action) > 0),
  blocker text,
  branch text,
  file_path text,
  source_url text,
  artifact_entity_id uuid references public.entities(id) on delete set null,
  note text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checkpoints_work_item_idx on public.context_checkpoints(work_item_id, created_at desc);

create table public.skills (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  description text not null default ''
);

create table public.learning_goals (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  demonstration_criterion text not null check (char_length(demonstration_criterion) > 0),
  status text not null default 'draft' check (status in ('draft', 'shaped', 'achieved', 'abandoned')),
  achieved_at timestamptz
);

create table public.learning_goal_skills (
  learning_goal_id uuid not null references public.learning_goals(entity_id) on delete cascade,
  skill_id uuid not null references public.skills(entity_id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  primary key (learning_goal_id, skill_id)
);

create table public.learning_evidence (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  learning_goal_id uuid not null references public.learning_goals(entity_id) on delete cascade,
  focus_session_id uuid references public.focus_sessions(id) on delete set null,
  artifact_entity_id uuid references public.entities(id) on delete set null,
  criterion text not null,
  assessment_method text not null,
  result public.learning_result not null,
  feedback text not null default '',
  user_accepted boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.entity_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_entity_id uuid not null references public.entities(id) on delete cascade,
  target_entity_id uuid not null references public.entities(id) on delete cascade,
  relation text not null check (char_length(relation) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (source_entity_id, target_entity_id, relation),
  check (source_entity_id <> target_entity_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type public.review_type not null,
  template_version integer not null default 1,
  answers jsonb not null default '{}'::jsonb,
  summary text not null default '',
  command_ids uuid[] not null default '{}',
  completed_by uuid not null references auth.users(id),
  completed_at timestamptz not null default now()
);

create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  command_name text not null,
  command_args jsonb not null,
  preview_diff jsonb not null,
  source_entity_ids uuid[] not null default '{}',
  risk text not null check (risk in ('low', 'medium', 'high')),
  expected_versions jsonb not null default '{}'::jsonb,
  status public.ai_proposal_status not null default 'pending',
  supersedes_id uuid references public.ai_proposals(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.ai_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_id uuid not null references public.ai_proposals(id) on delete restrict,
  status public.ai_execution_status not null default 'queued',
  requested_by uuid not null references auth.users(id),
  idempotency_key uuid not null,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (workspace_id, idempotency_key)
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  source text not null check (source in ('user', 'ai', 'integration', 'system')),
  command_name text not null,
  entity_ids uuid[] not null default '{}',
  summary_diff jsonb not null default '{}'::jsonb,
  correlation_id uuid not null,
  occurred_at timestamptz not null default now()
);
create index activity_workspace_time_idx on public.activity_events(workspace_id, occurred_at desc);

-- Composite foreign keys prevent a row from pointing across Workspace boundaries.
alter table public.entities add constraint entities_id_workspace_key unique (id, workspace_id);
alter table public.projects add constraint projects_id_workspace_key unique (entity_id, workspace_id);
alter table public.work_items add constraint work_items_id_workspace_key unique (entity_id, workspace_id);
alter table public.focus_sessions add constraint focus_sessions_id_workspace_key unique (id, workspace_id);
alter table public.skills add constraint skills_id_workspace_key unique (entity_id, workspace_id);
alter table public.learning_goals add constraint learning_goals_id_workspace_key unique (entity_id, workspace_id);

alter table public.projects add constraint projects_entity_workspace_fk foreign key (entity_id, workspace_id) references public.entities(id, workspace_id) on delete cascade;
alter table public.requirements add constraint requirements_entity_workspace_fk foreign key (entity_id, workspace_id) references public.entities(id, workspace_id) on delete cascade;
alter table public.requirements add constraint requirements_project_workspace_fk foreign key (project_id, workspace_id) references public.projects(entity_id, workspace_id) on delete cascade;
alter table public.commitments add constraint commitments_target_workspace_fk foreign key (target_entity_id, workspace_id) references public.entities(id, workspace_id) on delete cascade;
alter table public.work_items add constraint work_items_entity_workspace_fk foreign key (entity_id, workspace_id) references public.entities(id, workspace_id) on delete cascade;
alter table public.work_items add constraint work_items_context_workspace_fk foreign key (primary_context_entity_id, workspace_id) references public.entities(id, workspace_id) on delete restrict;
alter table public.focus_sessions add constraint sessions_item_workspace_fk foreign key (work_item_id, workspace_id) references public.work_items(entity_id, workspace_id) on delete restrict;
alter table public.context_checkpoints add constraint checkpoints_session_workspace_fk foreign key (focus_session_id, workspace_id) references public.focus_sessions(id, workspace_id) on delete cascade;
alter table public.context_checkpoints add constraint checkpoints_item_workspace_fk foreign key (work_item_id, workspace_id) references public.work_items(entity_id, workspace_id) on delete restrict;
alter table public.skills add constraint skills_entity_workspace_fk foreign key (entity_id, workspace_id) references public.entities(id, workspace_id) on delete cascade;
alter table public.learning_goals add constraint goals_entity_workspace_fk foreign key (entity_id, workspace_id) references public.entities(id, workspace_id) on delete cascade;
alter table public.learning_goal_skills add constraint goal_skills_goal_workspace_fk foreign key (learning_goal_id, workspace_id) references public.learning_goals(entity_id, workspace_id) on delete cascade;
alter table public.learning_goal_skills add constraint goal_skills_skill_workspace_fk foreign key (skill_id, workspace_id) references public.skills(entity_id, workspace_id) on delete cascade;
alter table public.learning_evidence add constraint evidence_entity_workspace_fk foreign key (entity_id, workspace_id) references public.entities(id, workspace_id) on delete cascade;
alter table public.learning_evidence add constraint evidence_goal_workspace_fk foreign key (learning_goal_id, workspace_id) references public.learning_goals(entity_id, workspace_id) on delete cascade;
alter table public.entity_links add constraint links_source_workspace_fk foreign key (source_entity_id, workspace_id) references public.entities(id, workspace_id) on delete cascade;
alter table public.entity_links add constraint links_target_workspace_fk foreign key (target_entity_id, workspace_id) references public.entities(id, workspace_id) on delete cascade;

-- Every Data API table is protected by RLS and explicit workspace membership.
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.entities enable row level security;
alter table public.projects enable row level security;
alter table public.requirements enable row level security;
alter table public.commitments enable row level security;
alter table public.work_items enable row level security;
alter table public.inbox_items enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.context_checkpoints enable row level security;
alter table public.skills enable row level security;
alter table public.learning_goals enable row level security;
alter table public.learning_goal_skills enable row level security;
alter table public.learning_evidence enable row level security;
alter table public.entity_links enable row level security;
alter table public.reviews enable row level security;
alter table public.ai_proposals enable row level security;
alter table public.ai_executions enable row level security;
alter table public.activity_events enable row level security;

create policy "members read workspaces" on public.workspaces for select to authenticated using (private.is_workspace_member(id));
create policy "members update workspaces" on public.workspaces for update to authenticated using (private.is_workspace_member(id)) with check (private.is_workspace_member(id));
create policy "members read memberships" on public.workspace_members for select to authenticated using (private.is_workspace_member(workspace_id));

-- Domain tables share one authorization rule, but each policy is explicit and auditable.
create policy "members manage entities" on public.entities for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage projects" on public.projects for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage requirements" on public.requirements for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage commitments" on public.commitments for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage work items" on public.work_items for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage inbox" on public.inbox_items for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id) and created_by = (select auth.uid()));
create policy "members manage sessions" on public.focus_sessions for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id) and user_id = (select auth.uid()));
create policy "members manage checkpoints" on public.context_checkpoints for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage skills" on public.skills for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage learning goals" on public.learning_goals for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage goal skills" on public.learning_goal_skills for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage learning evidence" on public.learning_evidence for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members manage entity links" on public.entity_links for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members read reviews" on public.reviews for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "members create reviews" on public.reviews for insert to authenticated with check (private.is_workspace_member(workspace_id) and completed_by = (select auth.uid()));
create policy "members manage proposals" on public.ai_proposals for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
create policy "members read executions" on public.ai_executions for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "members create executions" on public.ai_executions for insert to authenticated with check (private.is_workspace_member(workspace_id) and requested_by = (select auth.uid()));
create policy "members read activity" on public.activity_events for select to authenticated using (private.is_workspace_member(workspace_id));

grant select, insert, update, delete on table
  public.entities, public.projects, public.requirements, public.commitments,
  public.work_items, public.inbox_items, public.focus_sessions, public.context_checkpoints,
  public.skills, public.learning_goals, public.learning_goal_skills, public.learning_evidence,
  public.entity_links, public.ai_proposals
to authenticated;
grant select, update on table public.workspaces to authenticated;
grant select on table public.workspace_members, public.activity_events to authenticated;
grant select, insert on table public.reviews, public.ai_executions to authenticated;

create or replace function public.capture_item(
  target_workspace_id uuid,
  capture_content text,
  capture_kind public.capture_kind,
  command_idempotency_key uuid
)
returns public.inbox_items
language plpgsql
security invoker
set search_path = ''
as $$
declare captured public.inbox_items;
begin
  if btrim(capture_content) = '' then raise exception 'capture_content_required'; end if;
  insert into public.inbox_items (workspace_id, kind, raw_content, idempotency_key, created_by)
  values (target_workspace_id, capture_kind, btrim(capture_content), command_idempotency_key, (select auth.uid()))
  on conflict (workspace_id, idempotency_key) do update set raw_content = public.inbox_items.raw_content
  returning * into captured;
  return captured;
end;
$$;

create or replace function public.start_focus_session(
  target_workspace_id uuid,
  target_work_item_id uuid,
  command_idempotency_key uuid
)
returns public.focus_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare session_record public.focus_sessions;
begin
  update public.context_checkpoints checkpoint
  set locked_at = now()
  where checkpoint.work_item_id = target_work_item_id and checkpoint.locked_at is null;

  insert into public.focus_sessions (workspace_id, work_item_id, user_id, idempotency_key)
  values (target_workspace_id, target_work_item_id, (select auth.uid()), command_idempotency_key)
  on conflict (workspace_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into session_record;

  update public.work_items set status = 'in_progress'
  where entity_id = target_work_item_id and status = 'open';
  return session_record;
end;
$$;

create or replace function public.end_focus_session(
  target_session_id uuid,
  reason public.session_end_reason,
  checkpoint_current_state text default null,
  checkpoint_next_action text default null
)
returns public.focus_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare session_record public.focus_sessions;
begin
  select * into session_record from public.focus_sessions
  where id = target_session_id and ended_at is null for update;
  if not found then raise exception 'running_session_not_found'; end if;

  if reason <> 'work_item_completed' and (btrim(coalesce(checkpoint_current_state, '')) = '' or btrim(coalesce(checkpoint_next_action, '')) = '') then
    raise exception 'checkpoint_required';
  end if;

  if reason <> 'work_item_completed' then
    insert into public.context_checkpoints (workspace_id, focus_session_id, work_item_id, current_state, next_action)
    values (session_record.workspace_id, session_record.id, session_record.work_item_id, btrim(checkpoint_current_state), btrim(checkpoint_next_action));
  else
    update public.work_items set status = 'completed', completed_at = now() where entity_id = session_record.work_item_id;
  end if;

  update public.focus_sessions set ended_at = now(), end_reason = reason
  where id = target_session_id returning * into session_record;
  return session_record;
end;
$$;

revoke all on function public.capture_item(uuid, text, public.capture_kind, uuid) from public, anon;
revoke all on function public.start_focus_session(uuid, uuid, uuid) from public, anon;
revoke all on function public.end_focus_session(uuid, public.session_end_reason, text, text) from public, anon;
grant execute on function public.capture_item(uuid, text, public.capture_kind, uuid) to authenticated;
grant execute on function public.start_focus_session(uuid, uuid, uuid) to authenticated;
grant execute on function public.end_focus_session(uuid, public.session_end_reason, text, text) to authenticated;
