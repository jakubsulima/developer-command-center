\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then raise exception 'assertion_failed: %', message; end if;
end;
$$;

insert into auth.users (id, raw_user_meta_data)
values ('10000000-0000-4000-8000-000000000001', '{"workspace_name":"Plan test"}');
select workspace_id as workspace_id from public.workspace_members
where user_id = '10000000-0000-4000-8000-000000000001' \gset

set role authenticated;
set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

insert into public.goals (id, workspace_id, title, outcome)
values ('10000000-0000-4000-8000-000000000010', :'workspace_id', 'Cel tygodnia', 'Wynik');
insert into public.actions (id, workspace_id, goal_id, title, status, blocker, scheduled_for)
values ('10000000-0000-4000-8000-000000000020', :'workspace_id',
  '10000000-0000-4000-8000-000000000010', 'Zadanie', 'blocked', 'Czekam', '2026-09-01');

select public.complete_weekly_review_v2(
  :'workspace_id', 'Decyzja', '{"completedActions":"2"}'::jsonb,
  array['10000000-0000-4000-8000-000000000010']::uuid[],
  '10000000-0000-4000-8000-000000000030'
);
select pg_temp.assert_true((select answers -> 'selectedGoalIds' from public.reviews limit 1) =
  '["10000000-0000-4000-8000-000000000010"]'::jsonb, 'chosen goal was not persisted');

select public.set_action_status_review_checked(
  '10000000-0000-4000-8000-000000000020', 1, 'blocked', 'Czekam', '2026-09-09',
  '10000000-0000-4000-8000-000000000031'
);
select pg_temp.assert_true((select count(*) from public.progress_entries) = 0,
  'rescheduling a blocker produced a duplicate progress entry');
select pg_temp.assert_true(jsonb_array_length(public.get_waiting_actions_page(
  :'workspace_id', 'waiting', null, null, '2026-09-08') -> 'items') = 0,
  'waiting queue opened before review date');
select pg_temp.assert_true(jsonb_array_length(public.get_waiting_actions_page(
  :'workspace_id', 'waiting', null, null, '2026-09-09') -> 'items') = 1,
  'waiting queue omitted due blocker');
select pg_temp.assert_true((select scheduled_for from public.actions where id =
  '10000000-0000-4000-8000-000000000020') = '2026-09-01',
  'review date changed action schedule');

select public.set_action_status_checked(
  '10000000-0000-4000-8000-000000000020', 2, 'ready', null,
  '10000000-0000-4000-8000-000000000032'
);
select pg_temp.assert_true((select review_on is null from public.actions where id =
  '10000000-0000-4000-8000-000000000020'), 'older status command did not clear review date');

rollback;
