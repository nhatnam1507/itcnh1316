-- Proves that anon and authenticated non-admin callers cannot read or write any table,
-- and that an admin can manage people through RLS.
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'rls-admin@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'rls-user@test.local', 'authenticated', 'authenticated');
insert into public.admins (user_id) values ('aaaaaaaa-0000-4000-8000-000000000001');
insert into public.people (id, full_name, date_of_birth, mobile_phone, address)
values ('cccccccc-0000-4000-8000-000000000001', 'RLS Person', '2000-01-01', '+84912345678', '1 Test Street, Hà Nội');
insert into public.change_requests (id, person_id, proposed_full_name)
values ('dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'Changed Name');
insert into public.rate_limit_events (bucket, fingerprint) values ('unlock', 'rls-fingerprint');

-- RLS is enabled everywhere.
select ok((select relrowsecurity from pg_class where oid = 'public.people'::regclass), 'RLS enabled on people');
select ok((select relrowsecurity from pg_class where oid = 'public.change_requests'::regclass), 'RLS enabled on change_requests');
select ok((select relrowsecurity from pg_class where oid = 'public.admins'::regclass), 'RLS enabled on admins');
select ok((select relrowsecurity from pg_class where oid = 'public.rate_limit_events'::regclass), 'RLS enabled on rate_limit_events');

-- ---------- anon ----------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.people', '42501', null, 'anon cannot read people');
select throws_ok('select * from public.change_requests', '42501', null, 'anon cannot read change_requests');
select throws_ok('select * from public.admins', '42501', null, 'anon cannot read admins');
select throws_ok('select * from public.rate_limit_events', '42501', null, 'anon cannot read rate_limit_events');
select throws_ok(
  $$insert into public.people (full_name, date_of_birth, mobile_phone, address)
    values ('Intruder', '2000-01-01', '+84912345679', 'Somewhere 1')$$,
  '42501', null, 'anon cannot insert people');
select throws_ok($$update public.people set full_name = 'Hacked'$$, '42501', null, 'anon cannot update people');
select throws_ok('delete from public.people', '42501', null, 'anon cannot delete people');
select throws_ok(
  $$insert into public.change_requests (person_id, proposed_full_name)
    values ('cccccccc-0000-4000-8000-000000000001', 'Sneaky')$$,
  '42501', null, 'anon cannot insert change_requests');
select throws_ok($$update public.change_requests set status = 'approved'$$, '42501', null, 'anon cannot update change_requests');
select throws_ok('delete from public.change_requests', '42501', null, 'anon cannot delete change_requests');
select throws_ok(
  $$insert into public.admins (user_id) values ('bbbbbbbb-0000-4000-8000-000000000001')$$,
  '42501', null, 'anon cannot insert admins');
select throws_ok(
  $$insert into public.rate_limit_events (bucket, fingerprint) values ('unlock', 'x')$$,
  '42501', null, 'anon cannot insert rate_limit_events');
select throws_ok('select public.is_admin()', '42501', null, 'anon cannot execute is_admin');
select throws_ok(
  $$select public.approve_change_request('dddddddd-0000-4000-8000-000000000001')$$,
  '42501', null, 'anon cannot execute approve_change_request');
select throws_ok(
  $$select public.reject_change_request('dddddddd-0000-4000-8000-000000000001')$$,
  '42501', null, 'anon cannot execute reject_change_request');
select throws_ok(
  $$select public.consume_rate_limit('unlock', 'x', interval '1 minute', 5)$$,
  '42501', null, 'anon cannot execute consume_rate_limit');
reset role;

-- ---------- authenticated non-admin ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(public.is_admin(), false, 'non-admin is not an admin');
select is_empty('select * from public.people', 'non-admin sees no people');
select is_empty('select * from public.change_requests', 'non-admin sees no change_requests');
select is_empty('select * from public.admins', 'non-admin sees no admins');
select throws_ok('select * from public.rate_limit_events', '42501', null, 'non-admin cannot read rate_limit_events');
select throws_ok(
  $$insert into public.people (full_name, date_of_birth, mobile_phone, address)
    values ('Intruder', '2000-01-01', '+84912345679', 'Somewhere 1')$$,
  '42501', null, 'non-admin cannot insert people');
select is_empty($$update public.people set full_name = 'Hacked' returning id$$, 'non-admin updates no people');
select is_empty('delete from public.people returning id', 'non-admin deletes no people');
select throws_ok(
  $$insert into public.change_requests (person_id, proposed_full_name)
    values ('cccccccc-0000-4000-8000-000000000001', 'Sneaky')$$,
  '42501', null, 'non-admin cannot insert change_requests');
select is_empty($$update public.change_requests set proposed_full_name = 'X' returning id$$, 'non-admin updates no change_requests');
select throws_ok('delete from public.change_requests', '42501', null, 'non-admin cannot delete change_requests');
select throws_ok(
  $$insert into public.admins (user_id) values ('bbbbbbbb-0000-4000-8000-000000000001')$$,
  '42501', null, 'non-admin cannot make themselves an admin');
select throws_ok(
  $$select public.approve_change_request('dddddddd-0000-4000-8000-000000000001')$$,
  '42501', 'not authorized', 'non-admin cannot approve');
select throws_ok(
  $$select public.reject_change_request('dddddddd-0000-4000-8000-000000000001')$$,
  '42501', 'not authorized', 'non-admin cannot reject');
select throws_ok(
  $$select public.consume_rate_limit('unlock', 'x', interval '1 minute', 5)$$,
  '42501', null, 'non-admin cannot execute consume_rate_limit');
reset role;

select is(
  (select full_name from public.people where id = 'cccccccc-0000-4000-8000-000000000001'),
  'RLS Person', 'person unchanged after anon and non-admin attempts');
select is(
  (select status::text from public.change_requests where id = 'dddddddd-0000-4000-8000-000000000001'),
  'pending', 'change request unchanged after anon and non-admin attempts');
select is(
  (select count(*)::int from public.admins where user_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  0, 'the non-admin was not made an admin');

-- ---------- admin ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(public.is_admin(), true, 'admin is an admin');
select isnt_empty('select * from public.people', 'admin can read people');
select isnt_empty('select * from public.change_requests', 'admin can read change_requests');
select results_eq(
  'select user_id from public.admins',
  $$values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid)$$,
  'admin reads only their own admin row');
select lives_ok(
  $$insert into public.people (id, full_name, date_of_birth, mobile_phone, address)
    values ('cccccccc-0000-4000-8000-000000000002', 'Admin Created', '1999-02-02', '+84387654321', '2 Admin Road, Huế')$$,
  'admin can insert people');
select isnt_empty(
  $$update public.people set full_name = 'Admin Edited' where id = 'cccccccc-0000-4000-8000-000000000002' returning id$$,
  'admin can update people');
select isnt_empty(
  $$delete from public.people where id = 'cccccccc-0000-4000-8000-000000000002' returning id$$,
  'admin can delete people');
select throws_ok(
  $$insert into public.admins (user_id) values ('bbbbbbbb-0000-4000-8000-000000000001')$$,
  '42501', null, 'admin cannot add admins through the API');
reset role;

select * from finish();
rollback;
