\set ON_ERROR_STOP on

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if not condition then raise exception 'assertion_failed: %', message; end if;
end;
$$;

insert into auth.users (id, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', '{"workspace_name":"Workspace A"}'),
  ('20000000-0000-0000-0000-000000000002', '{"workspace_name":"Workspace B"}');

select workspace_id as workspace_a from public.workspace_members where user_id = '10000000-0000-0000-0000-000000000001' \gset
select workspace_id as workspace_b from public.workspace_members where user_id = '20000000-0000-0000-0000-000000000002' \gset
select set_config('test.workspace_a', :'workspace_a', false);

insert into public.entities (id, workspace_id, type, title)
values ('a0000000-0000-0000-0000-000000000001', :'workspace_a', 'project', 'Sekretny projekt A');

set role authenticated;
set request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
select pg_temp.assert_true((select count(*) from public.entities) = 0, 'SELECT leaked another workspace');

do $$
begin
  begin
    insert into public.entities (workspace_id, type, title)
    values (current_setting('test.workspace_a')::uuid, 'note', 'Nieautoryzowany insert');
    raise exception 'assertion_failed: INSERT crossed workspace boundary';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

update public.entities set title = 'Przejęty projekt' where id = 'a0000000-0000-0000-0000-000000000001';
delete from public.entities where id = 'a0000000-0000-0000-0000-000000000001';

reset role;
select pg_temp.assert_true(
  (select title from public.entities where id = 'a0000000-0000-0000-0000-000000000001') = 'Sekretny projekt A',
  'UPDATE or DELETE crossed workspace boundary'
);

set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select count(*) from public.entities) = 1, 'owner cannot SELECT own workspace');
update public.entities set title = 'Projekt A po aktualizacji' where id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select title from public.entities limit 1) = 'Projekt A po aktualizacji', 'owner cannot UPDATE own workspace');
delete from public.entities where id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select count(*) from public.entities) = 0, 'owner cannot DELETE own workspace');

reset role;
select 'RLS isolation verified for SELECT, INSERT, UPDATE and DELETE' as result;
