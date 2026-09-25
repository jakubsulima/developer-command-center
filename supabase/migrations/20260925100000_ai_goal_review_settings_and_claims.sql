-- Workspace-owned review settings and durable deduplication for goal reviews.
alter table public.workspaces
  add column ai_review_window_days smallint not null default 28
    check (ai_review_window_days in (7, 14, 28)),
  add column ai_review_cache_hours smallint not null default 72
    check (ai_review_cache_hours in (24, 72, 168));

alter table public.ai_goal_reviews
  add column window_days smallint not null default 28
    check (window_days in (7, 14, 28));

create table private.ai_goal_review_claims (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  window_days smallint not null check (window_days in (7, 14, 28)),
  context_hash text not null check (char_length(context_hash) = 64),
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  model text not null check (char_length(btrim(model)) between 1 and 200),
  prompt_version integer not null check (prompt_version > 0),
  schema_version integer not null check (schema_version > 0),
  owner_token uuid not null,
  lease_expires_at timestamptz not null,
  primary key (workspace_id, window_days, context_hash, provider, model, prompt_version, schema_version)
);
alter table private.ai_goal_review_claims enable row level security;
revoke all on table private.ai_goal_review_claims from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on table private.ai_goal_review_claims to service_role;

create or replace function public.try_claim_ai_goal_review(
  target_workspace_id uuid,
  target_window_days smallint,
  target_context_hash text,
  target_provider text,
  target_model text,
  target_prompt_version integer,
  target_schema_version integer,
  target_owner_token uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare claimed boolean := false;
begin
  if target_workspace_id is null or target_window_days not in (7, 14, 28)
     or target_context_hash is null or char_length(target_context_hash) <> 64
     or target_provider is null or target_model is null
     or target_prompt_version <= 0 or target_schema_version <= 0
     or target_owner_token is null then
    raise exception 'invalid_ai_goal_review_claim';
  end if;

  insert into private.ai_goal_review_claims (
    workspace_id, window_days, context_hash, provider, model,
    prompt_version, schema_version, owner_token, lease_expires_at
  ) values (
    target_workspace_id, target_window_days, target_context_hash, target_provider, target_model,
    target_prompt_version, target_schema_version, target_owner_token, now() + interval '5 minutes'
  )
  on conflict (workspace_id, window_days, context_hash, provider, model, prompt_version, schema_version)
  do update set owner_token = excluded.owner_token, lease_expires_at = excluded.lease_expires_at
    where private.ai_goal_review_claims.lease_expires_at <= now()
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;
revoke all on function public.try_claim_ai_goal_review(uuid, smallint, text, text, text, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.try_claim_ai_goal_review(uuid, smallint, text, text, text, integer, integer, uuid) to service_role;

create or replace function public.release_ai_goal_review_claim(
  target_workspace_id uuid,
  target_window_days smallint,
  target_context_hash text,
  target_provider text,
  target_model text,
  target_prompt_version integer,
  target_schema_version integer,
  target_owner_token uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare released boolean := false;
begin
  delete from private.ai_goal_review_claims
  where workspace_id = target_workspace_id and window_days = target_window_days
    and context_hash = target_context_hash and provider = target_provider and model = target_model
    and prompt_version = target_prompt_version and schema_version = target_schema_version
    and owner_token = target_owner_token
  returning true into released;
  return coalesce(released, false);
end;
$$;
revoke all on function public.release_ai_goal_review_claim(uuid, smallint, text, text, text, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.release_ai_goal_review_claim(uuid, smallint, text, text, text, integer, integer, uuid) to service_role;
