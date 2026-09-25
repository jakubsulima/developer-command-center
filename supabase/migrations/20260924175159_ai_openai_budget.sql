-- Server-only accounting for paid AI calls. The monthly row serializes all
-- reservations, including concurrent requests from different workspaces.
create table private.ai_budget_buckets (
  bucket_key text primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  period_start date not null,
  reserved_nano_usd bigint not null default 0 check (reserved_nano_usd >= 0),
  accounted_nano_usd bigint not null default 0 check (accounted_nano_usd >= 0),
  created_at timestamptz not null default now()
);
alter table private.ai_budget_buckets enable row level security;
revoke all on table private.ai_budget_buckets from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on table private.ai_budget_buckets to service_role;
grant select on table public.workspace_members to service_role;

alter table public.ai_runs
  add column reserved_nano_usd bigint not null default 0 check (reserved_nano_usd >= 0),
  add column accounted_nano_usd bigint not null default 0 check (accounted_nano_usd >= 0),
  add column cost_is_estimate boolean not null default false,
  add column attempts smallint not null default 0 check (attempts between 0 and 3),
  add column input_price_nano_per_token integer not null default 0 check (input_price_nano_per_token >= 0),
  add column output_price_nano_per_token integer not null default 0 check (output_price_nano_per_token >= 0);

create or replace function public.reserve_ai_run(
  target_workspace_id uuid,
  target_user_id uuid,
  target_capability text,
  target_provider text,
  target_model text,
  target_prompt_version integer,
  target_schema_version integer,
  target_input_chars integer,
  target_reserved_nano_usd bigint,
  target_input_price_nano_per_token integer,
  target_output_price_nano_per_token integer,
  target_daily_limit integer,
  target_force_refresh boolean,
  target_daily_budget_nano_usd bigint,
  target_monthly_budget_nano_usd bigint
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  run_id uuid;
  month_key text := 'project:' || to_char(now() at time zone 'utc', 'YYYY-MM');
  day_key text := 'workspace:' || target_workspace_id::text || ':' || to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  month_start date := date_trunc('month', now() at time zone 'utc')::date;
  day_start date := (now() at time zone 'utc')::date;
  month_reserved bigint;
  month_accounted bigint;
  day_reserved bigint;
  day_accounted bigint;
  daily_count integer;
begin
  if target_workspace_id is null or target_user_id is null or target_reserved_nano_usd < 0
     or target_daily_budget_nano_usd <= 0 or target_monthly_budget_nano_usd <= 0
     or target_daily_limit not between 1 and 200 or target_input_chars < 0
     or target_capability not in ('goal_portfolio_review', 'inbox_triage')
     or target_provider is null or target_model is null then
    raise exception 'invalid_ai_reservation';
  end if;
  if not exists (select 1 from public.workspace_members membership
                 where membership.workspace_id = target_workspace_id and membership.user_id = target_user_id) then
    raise exception 'workspace_not_available';
  end if;

  insert into private.ai_budget_buckets (bucket_key, period_start)
  values (month_key, month_start) on conflict do nothing;
  select reserved_nano_usd, accounted_nano_usd into month_reserved, month_accounted
    from private.ai_budget_buckets where bucket_key = month_key for update;
  insert into private.ai_budget_buckets (bucket_key, workspace_id, period_start)
  values (day_key, target_workspace_id, day_start) on conflict do nothing;
  select reserved_nano_usd, accounted_nano_usd into day_reserved, day_accounted
    from private.ai_budget_buckets where bucket_key = day_key for update;

  select count(*) into daily_count from public.ai_runs run
    where run.workspace_id = target_workspace_id and run.user_id = target_user_id
      and run.capability = target_capability and run.created_at >= (day_start::timestamp at time zone 'utc');
  if daily_count >= target_daily_limit then raise exception 'ai_daily_limit'; end if;
  if target_force_refresh and exists (
    select 1 from public.ai_runs run where run.workspace_id = target_workspace_id
      and run.user_id = target_user_id and run.capability = target_capability
      and run.created_at >= now() - interval '5 minutes'
  ) then raise exception 'ai_refresh_cooldown'; end if;
  if month_reserved + month_accounted + target_reserved_nano_usd > target_monthly_budget_nano_usd
     or day_reserved + day_accounted + target_reserved_nano_usd > target_daily_budget_nano_usd then
    raise exception 'ai_budget_exceeded';
  end if;

  update private.ai_budget_buckets set reserved_nano_usd = reserved_nano_usd + target_reserved_nano_usd
    where bucket_key in (month_key, day_key);
  insert into public.ai_runs (
    workspace_id, user_id, capability, provider, model, prompt_version,
    schema_version, status, input_chars, reserved_nano_usd,
    input_price_nano_per_token, output_price_nano_per_token
  ) values (
    target_workspace_id, target_user_id, target_capability, target_provider,
    target_model, target_prompt_version, target_schema_version, 'running',
    target_input_chars, target_reserved_nano_usd,
    target_input_price_nano_per_token, target_output_price_nano_per_token
  ) returning id into run_id;
  return run_id;
end;
$$;
revoke all on function public.reserve_ai_run(uuid, uuid, text, text, text, integer, integer, integer, bigint, integer, integer, integer, boolean, bigint, bigint) from public, anon, authenticated;
grant execute on function public.reserve_ai_run(uuid, uuid, text, text, text, integer, integer, integer, bigint, integer, integer, integer, boolean, bigint, bigint) to service_role;

create or replace function public.finish_ai_run(
  target_run_id uuid,
  target_status text,
  target_error_code text,
  target_input_tokens integer,
  target_output_tokens integer,
  target_accounted_nano_usd bigint,
  target_cost_is_estimate boolean,
  target_attempts integer,
  target_provider_request_id text,
  target_latency_ms integer
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  run_row public.ai_runs%rowtype;
  month_key text;
  day_key text;
  changed_rows integer;
begin
  select * into run_row from public.ai_runs where id = target_run_id for update;
  if not found or run_row.status <> 'running' then raise exception 'ai_run_not_running'; end if;
  if target_status not in ('succeeded', 'failed') or target_accounted_nano_usd < 0
     or target_accounted_nano_usd > run_row.reserved_nano_usd or target_attempts not between 0 and 3
     or target_input_tokens < 0 or target_output_tokens < 0 or target_latency_ms < 0 then
    raise exception 'invalid_ai_settlement';
  end if;
  month_key := 'project:' || to_char(run_row.created_at at time zone 'utc', 'YYYY-MM');
  day_key := 'workspace:' || run_row.workspace_id::text || ':' || to_char(run_row.created_at at time zone 'utc', 'YYYY-MM-DD');
  update private.ai_budget_buckets
    set reserved_nano_usd = reserved_nano_usd - run_row.reserved_nano_usd,
        accounted_nano_usd = accounted_nano_usd + target_accounted_nano_usd
    where bucket_key in (month_key, day_key);
  get diagnostics changed_rows = row_count;
  if changed_rows <> 2 then raise exception 'ai_budget_bucket_missing'; end if;
  update public.ai_runs set status = target_status, error_code = target_error_code,
    input_tokens = target_input_tokens, output_tokens = target_output_tokens,
    accounted_nano_usd = target_accounted_nano_usd, cost_is_estimate = target_cost_is_estimate,
    attempts = target_attempts, provider_request_id = target_provider_request_id,
    latency_ms = target_latency_ms, finished_at = now()
    where id = target_run_id;
end;
$$;
revoke all on function public.finish_ai_run(uuid, text, text, integer, integer, bigint, boolean, integer, text, integer) from public, anon, authenticated;
grant execute on function public.finish_ai_run(uuid, text, text, integer, integer, bigint, boolean, integer, text, integer) to service_role;
