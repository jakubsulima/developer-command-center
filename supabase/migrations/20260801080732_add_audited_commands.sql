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

  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'user', 'capture_item', '{}', jsonb_build_object('inboxItemId', captured.id, 'kind', captured.kind), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
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
  update public.context_checkpoints checkpoint set locked_at = now()
  where checkpoint.work_item_id = target_work_item_id and checkpoint.locked_at is null;

  insert into public.focus_sessions (workspace_id, work_item_id, user_id, idempotency_key)
  values (target_workspace_id, target_work_item_id, (select auth.uid()), command_idempotency_key)
  on conflict (workspace_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into session_record;

  update public.work_items set status = 'in_progress'
  where entity_id = target_work_item_id and status = 'open';
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'user', 'start_focus_session', array[target_work_item_id], jsonb_build_object('focusSessionId', session_record.id), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
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
  select * into session_record from public.focus_sessions where id = target_session_id for update;
  if not found then raise exception 'focus_session_not_found'; end if;
  if session_record.ended_at is not null then return session_record; end if;
  if reason <> 'work_item_completed' and (btrim(coalesce(checkpoint_current_state, '')) = '' or btrim(coalesce(checkpoint_next_action, '')) = '') then
    raise exception 'checkpoint_required';
  end if;
  if reason <> 'work_item_completed' then
    insert into public.context_checkpoints (workspace_id, focus_session_id, work_item_id, current_state, next_action)
    values (session_record.workspace_id, session_record.id, session_record.work_item_id, btrim(checkpoint_current_state), btrim(checkpoint_next_action));
  else
    update public.work_items set status = 'completed', completed_at = now() where entity_id = session_record.work_item_id;
  end if;
  update public.focus_sessions set ended_at = now(), end_reason = reason where id = target_session_id returning * into session_record;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (session_record.workspace_id, (select auth.uid()), 'user', 'end_focus_session', array[session_record.work_item_id], jsonb_build_object('focusSessionId', session_record.id, 'reason', reason), session_record.id)
  on conflict (workspace_id, correlation_id) do nothing;
  return session_record;
end;
$$;

create or replace function public.resolve_inbox_item(target_inbox_item_id uuid, command_idempotency_key uuid)
returns public.inbox_items
language plpgsql
security invoker
set search_path = ''
as $$
declare item public.inbox_items;
begin
  update public.inbox_items set status = 'resolved', resolved_at = coalesce(resolved_at, now())
  where id = target_inbox_item_id returning * into item;
  if not found then raise exception 'inbox_item_not_found'; end if;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (item.workspace_id, (select auth.uid()), 'user', 'resolve_inbox_item', '{}', jsonb_build_object('inboxItemId', item.id), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
  return item;
end;
$$;

create or replace function public.complete_weekly_review(target_workspace_id uuid, review_summary text, command_idempotency_key uuid)
returns public.reviews
language plpgsql
security invoker
set search_path = ''
as $$
declare review_record public.reviews;
begin
  select * into review_record from public.reviews
  where workspace_id = target_workspace_id and command_ids @> array[command_idempotency_key] limit 1;
  if found then return review_record; end if;
  insert into public.reviews (workspace_id, type, template_version, answers, summary, command_ids, completed_by)
  values (target_workspace_id, 'weekly', 1, '{"completed":true}', btrim(review_summary), array[command_idempotency_key], (select auth.uid()))
  returning * into review_record;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'user', 'complete_weekly_review', '{}', jsonb_build_object('reviewId', review_record.id), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
  return review_record;
end;
$$;

create or replace function public.approve_ai_proposal(target_proposal_id uuid, command_idempotency_key uuid)
returns public.ai_executions
language plpgsql
security invoker
set search_path = ''
as $$
declare proposal_record public.ai_proposals; execution_record public.ai_executions;
begin
  select * into execution_record from public.ai_executions where idempotency_key = command_idempotency_key;
  if found then return execution_record; end if;
  select * into proposal_record from public.ai_proposals where id = target_proposal_id for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if proposal_record.status <> 'pending' then raise exception 'proposal_not_pending'; end if;
  if proposal_record.expires_at <= now() then
    update public.ai_proposals set status = 'expired', decided_at = now() where id = target_proposal_id;
    raise exception 'proposal_expired';
  end if;
  update public.ai_proposals set status = 'approved', decided_at = now() where id = target_proposal_id;
  insert into public.ai_executions (workspace_id, proposal_id, status, requested_by, idempotency_key)
  values (proposal_record.workspace_id, proposal_record.id, 'queued', (select auth.uid()), command_idempotency_key)
  returning * into execution_record;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (proposal_record.workspace_id, (select auth.uid()), 'user', 'approve_ai_proposal', '{}', jsonb_build_object('proposalId', proposal_record.id, 'executionId', execution_record.id), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
  return execution_record;
end;
$$;

create or replace function public.reject_ai_proposal(target_proposal_id uuid, command_idempotency_key uuid)
returns public.ai_proposals
language plpgsql
security invoker
set search_path = ''
as $$
declare proposal_record public.ai_proposals;
begin
  select proposal.* into proposal_record
  from public.ai_proposals proposal
  where proposal.id = target_proposal_id
  for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if proposal_record.status = 'rejected' and exists (
    select 1 from public.activity_events event
    where event.workspace_id = proposal_record.workspace_id and event.correlation_id = command_idempotency_key
  ) then return proposal_record; end if;
  if proposal_record.status <> 'pending' then raise exception 'proposal_not_pending'; end if;
  update public.ai_proposals set status = 'rejected', decided_at = now()
  where id = target_proposal_id returning * into proposal_record;
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (proposal_record.workspace_id, (select auth.uid()), 'user', 'reject_ai_proposal', '{}', jsonb_build_object('proposalId', proposal_record.id), command_idempotency_key)
  on conflict (workspace_id, correlation_id) do nothing;
  return proposal_record;
end;
$$;

create or replace function public.record_learning_evidence(
  target_workspace_id uuid,
  target_learning_goal_id uuid,
  target_focus_session_id uuid,
  evidence_title text,
  evidence_result public.learning_result,
  evidence_feedback text,
  command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare evidence_entity_id uuid; goal_criterion text;
begin
  select event.entity_ids[1] into evidence_entity_id from public.activity_events event
  where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key and event.command_name = 'record_learning_evidence';
  if evidence_entity_id is not null then return evidence_entity_id; end if;
  if btrim(evidence_title) = '' then raise exception 'evidence_title_required'; end if;
  select demonstration_criterion into goal_criterion from public.learning_goals
  where entity_id = target_learning_goal_id and workspace_id = target_workspace_id;
  if not found then raise exception 'learning_goal_not_found'; end if;
  evidence_entity_id := gen_random_uuid();
  insert into public.entities (id, workspace_id, type, title)
  values (evidence_entity_id, target_workspace_id, 'learning_evidence', btrim(evidence_title));
  insert into public.learning_evidence (entity_id, workspace_id, learning_goal_id, focus_session_id, criterion, assessment_method, result, feedback, user_accepted)
  values (evidence_entity_id, target_workspace_id, target_learning_goal_id, target_focus_session_id, goal_criterion, 'self_assessment', evidence_result, btrim(evidence_feedback), true);
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'user', 'record_learning_evidence', array[evidence_entity_id, target_learning_goal_id], jsonb_build_object('result', evidence_result), command_idempotency_key);
  return evidence_entity_id;
end;
$$;

create or replace function public.create_learning_goal(
  target_workspace_id uuid,
  goal_title text,
  goal_criterion text,
  skill_title text,
  command_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare goal_entity_id uuid; skill_entity_id uuid;
begin
  select event.entity_ids[1] into goal_entity_id from public.activity_events event
  where event.workspace_id = target_workspace_id and event.correlation_id = command_idempotency_key and event.command_name = 'create_learning_goal';
  if goal_entity_id is not null then return goal_entity_id; end if;
  if btrim(goal_title) = '' or btrim(goal_criterion) = '' or btrim(skill_title) = '' then raise exception 'learning_goal_fields_required'; end if;
  goal_entity_id := gen_random_uuid(); skill_entity_id := gen_random_uuid();
  insert into public.entities (id, workspace_id, type, title) values
    (goal_entity_id, target_workspace_id, 'learning_goal', btrim(goal_title)),
    (skill_entity_id, target_workspace_id, 'skill', btrim(skill_title));
  insert into public.learning_goals (entity_id, workspace_id, demonstration_criterion, status)
  values (goal_entity_id, target_workspace_id, btrim(goal_criterion), 'shaped');
  insert into public.skills (entity_id, workspace_id) values (skill_entity_id, target_workspace_id);
  insert into public.learning_goal_skills (learning_goal_id, skill_id, workspace_id)
  values (goal_entity_id, skill_entity_id, target_workspace_id);
  insert into public.activity_events (workspace_id, actor_user_id, source, command_name, entity_ids, summary_diff, correlation_id)
  values (target_workspace_id, (select auth.uid()), 'user', 'create_learning_goal', array[goal_entity_id, skill_entity_id], jsonb_build_object('title', goal_title, 'criterion', goal_criterion), command_idempotency_key);
  return goal_entity_id;
end;
$$;

revoke all on function public.resolve_inbox_item(uuid, uuid), public.complete_weekly_review(uuid, text, uuid), public.reject_ai_proposal(uuid, uuid), public.record_learning_evidence(uuid, uuid, uuid, text, public.learning_result, text, uuid), public.create_learning_goal(uuid, text, text, text, uuid) from public, anon;
grant execute on function public.resolve_inbox_item(uuid, uuid), public.complete_weekly_review(uuid, text, uuid), public.reject_ai_proposal(uuid, uuid), public.record_learning_evidence(uuid, uuid, uuid, text, public.learning_result, text, uuid), public.create_learning_goal(uuid, text, text, text, uuid) to authenticated;
