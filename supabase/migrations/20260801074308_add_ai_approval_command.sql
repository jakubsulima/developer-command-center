create or replace function public.approve_ai_proposal(
  target_proposal_id uuid,
  command_idempotency_key uuid
)
returns public.ai_executions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  proposal_record public.ai_proposals;
  execution_record public.ai_executions;
begin
  select * into proposal_record
  from public.ai_proposals
  where id = target_proposal_id
  for update;

  if not found then raise exception 'proposal_not_found'; end if;
  if proposal_record.status <> 'pending' then raise exception 'proposal_not_pending'; end if;
  if proposal_record.expires_at <= now() then
    update public.ai_proposals set status = 'expired', decided_at = now()
    where id = target_proposal_id;
    raise exception 'proposal_expired';
  end if;

  update public.ai_proposals
  set status = 'approved', decided_at = now()
  where id = target_proposal_id;

  insert into public.ai_executions (
    workspace_id,
    proposal_id,
    status,
    requested_by,
    idempotency_key
  ) values (
    proposal_record.workspace_id,
    proposal_record.id,
    'queued',
    (select auth.uid()),
    command_idempotency_key
  )
  on conflict (workspace_id, idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning * into execution_record;

  return execution_record;
end;
$$;

revoke all on function public.approve_ai_proposal(uuid, uuid) from public, anon;
grant execute on function public.approve_ai_proposal(uuid, uuid) to authenticated;
