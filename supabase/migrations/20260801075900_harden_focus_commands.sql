-- A network retry after a successful commit returns the same ended session.
-- The session id is the natural idempotency key for this command.
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
  where id = target_session_id for update;
  if not found then raise exception 'focus_session_not_found'; end if;
  if session_record.ended_at is not null then return session_record; end if;

  if reason <> 'work_item_completed' and (btrim(coalesce(checkpoint_current_state, '')) = '' or btrim(coalesce(checkpoint_next_action, '')) = '') then
    raise exception 'checkpoint_required';
  end if;

  if reason <> 'work_item_completed' then
    insert into public.context_checkpoints (workspace_id, focus_session_id, work_item_id, current_state, next_action)
    values (session_record.workspace_id, session_record.id, session_record.work_item_id, btrim(checkpoint_current_state), btrim(checkpoint_next_action));
  else
    update public.work_items set status = 'completed', completed_at = now()
    where entity_id = session_record.work_item_id;
  end if;

  update public.focus_sessions set ended_at = now(), end_reason = reason
  where id = target_session_id returning * into session_record;
  return session_record;
end;
$$;

revoke all on function public.end_focus_session(uuid, public.session_end_reason, text, text) from public, anon;
grant execute on function public.end_focus_session(uuid, public.session_end_reason, text, text) to authenticated;
