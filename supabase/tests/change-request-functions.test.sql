-- Proves that approval applies only the proposed fields atomically, keeps the old values,
-- cannot run twice, and that rejection never touches the person.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, aud, role)
values ('aaaaaaaa-0000-4000-8000-000000000002', 'fn-admin@test.local', 'authenticated', 'authenticated');
insert into public.admins (user_id) values ('aaaaaaaa-0000-4000-8000-000000000002');

insert into public.people (id, full_name, date_of_birth, mobile_phone, address, latitude, longitude, location_source)
values
  ('cccccccc-0000-4000-8000-000000000011', 'Original Name', '2000-01-01', '+84912345678',
   '1 Old Street, Hà Nội', 21.0, 105.8, 'geocoded'),
  ('cccccccc-0000-4000-8000-000000000012', 'Mover', '2000-02-02', '+84387654321',
   '5 Before Road, Đà Nẵng', 16.0, 108.2, 'manual'),
  ('cccccccc-0000-4000-8000-000000000013', 'Unchanged Person', '2000-03-03', '+84705111222',
   '9 Stay Street, Huế', 16.4, 107.5, 'geocoded');

insert into public.change_requests (id, person_id, proposed_full_name, proposed_mobile_phone, requester_note)
values ('dddddddd-0000-4000-8000-000000000011', 'cccccccc-0000-4000-8000-000000000011',
        'Updated Name', '+84983000111', 'new number');
insert into public.change_requests (id, person_id, proposed_address)
values ('dddddddd-0000-4000-8000-000000000012', 'cccccccc-0000-4000-8000-000000000012', '7 After Avenue, Cần Thơ');
insert into public.change_requests (id, person_id, proposed_full_name)
values ('dddddddd-0000-4000-8000-000000000013', 'cccccccc-0000-4000-8000-000000000013', 'Should Not Apply');

-- Schema guards
select throws_ok(
  $$insert into public.change_requests (person_id) values ('cccccccc-0000-4000-8000-000000000011')$$,
  '23514', null, 'a change request must propose at least one field');
select throws_ok(
  $$insert into public.people (full_name, date_of_birth, mobile_phone, address)
    values ('Landline', '2000-01-01', '+842412345678', '1 Some Street')$$,
  '23514', null, 'non-mobile phone numbers are rejected');
select throws_ok(
  $$insert into public.people (full_name, date_of_birth, mobile_phone, address)
    values ('Future', current_date + 1, '+84912345670', '1 Some Street')$$,
  '23514', null, 'a future date of birth is rejected');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);

-- Approve a name + phone change.
select lives_ok(
  $$select public.approve_change_request('dddddddd-0000-4000-8000-000000000011', p_reviewer_note => '  looks right  ')$$,
  'admin approves a pending request');
select results_eq(
  $$select full_name, mobile_phone, date_of_birth, address, latitude, longitude, location_source
    from public.people where id = 'cccccccc-0000-4000-8000-000000000011'$$,
  $$values ('Updated Name'::text, '+84983000111'::text, date '2000-01-01', '1 Old Street, Hà Nội'::text,
            21.0::double precision, 105.8::double precision, 'geocoded'::text)$$,
  'approval applies only the proposed fields');
select is(
  (select previous_values from public.change_requests where id = 'dddddddd-0000-4000-8000-000000000011'),
  '{"full_name": "Original Name", "mobile_phone": "+84912345678"}'::jsonb,
  'previous_values keeps the old values of the changed fields');
select results_eq(
  $$select status::text, reviewed_by, reviewer_note, reviewed_at is not null
    from public.change_requests where id = 'dddddddd-0000-4000-8000-000000000011'$$,
  $$values ('approved'::text, 'aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'looks right'::text, true)$$,
  'approval records status, reviewer, trimmed note and time');
select throws_ok(
  $$select public.approve_change_request('dddddddd-0000-4000-8000-000000000011')$$,
  '55000', 'change request is not pending', 'a second approval fails');
select throws_ok(
  $$select public.reject_change_request('dddddddd-0000-4000-8000-000000000011')$$,
  '55000', 'change request is not pending', 'an approved request cannot be rejected');

-- Approve an address change with a manually corrected pin.
select throws_ok(
  $$select public.approve_change_request('dddddddd-0000-4000-8000-000000000012', 10.03, null, 'manual')$$,
  '22023', null, 'coordinates must be paired');
select throws_ok(
  $$select public.approve_change_request('dddddddd-0000-4000-8000-000000000012', 10.03, 105.78, 'guessed')$$,
  '22023', null, 'location source must be geocoded or manual');
select is(
  (select status::text from public.change_requests where id = 'dddddddd-0000-4000-8000-000000000012'),
  'pending', 'a failed approval leaves the request pending');
select is(
  (select (public.approve_change_request('dddddddd-0000-4000-8000-000000000012', 10.03, 105.78, 'manual')).address),
  '7 After Avenue, Cần Thơ', 'approval returns the updated person');
select results_eq(
  $$select address, latitude, longitude, location_source, full_name
    from public.people where id = 'cccccccc-0000-4000-8000-000000000012'$$,
  $$values ('7 After Avenue, Cần Thơ'::text, 10.03::double precision, 105.78::double precision, 'manual'::text, 'Mover'::text)$$,
  'address approval stores the new address and pin');
select is(
  (select previous_values from public.change_requests where id = 'dddddddd-0000-4000-8000-000000000012'),
  '{"address": "5 Before Road, Đà Nẵng", "latitude": 16.0, "longitude": 108.2, "location_source": "manual"}'::jsonb,
  'previous_values keeps the old address and pin');

-- Reject.
select lives_ok(
  $$select public.reject_change_request('dddddddd-0000-4000-8000-000000000013', 'not them')$$,
  'admin rejects a pending request');
select results_eq(
  $$select full_name, mobile_phone, address from public.people where id = 'cccccccc-0000-4000-8000-000000000013'$$,
  $$values ('Unchanged Person'::text, '+84705111222'::text, '9 Stay Street, Huế'::text)$$,
  'rejection leaves the person unchanged');
select results_eq(
  $$select status::text, reviewer_note, previous_values is null
    from public.change_requests where id = 'dddddddd-0000-4000-8000-000000000013'$$,
  $$values ('rejected'::text, 'not them'::text, true)$$,
  'rejection records the status and note only');
select throws_ok(
  $$select public.reject_change_request('dddddddd-0000-4000-8000-000000000013')$$,
  '55000', 'change request is not pending', 'a second rejection fails');
select throws_ok(
  $$select public.approve_change_request('dddddddd-0000-4000-8000-000000000013')$$,
  '55000', 'change request is not pending', 'a rejected request cannot be approved');
select throws_ok(
  $$select public.approve_change_request('dddddddd-0000-4000-8000-0000000000ff')$$,
  'P0002', 'change request not found', 'approving a missing request fails');

-- Admin cannot rewrite a reviewed request's status back to pending.
select throws_ok(
  $$update public.change_requests set status = 'pending' where id = 'dddddddd-0000-4000-8000-000000000013'$$,
  '23514', null, 'a reviewed request cannot be reopened without clearing the review');

-- Deleting a person cascades to their change requests.
reset role;
insert into public.change_requests (id, person_id, proposed_full_name)
values ('dddddddd-0000-4000-8000-000000000014', 'cccccccc-0000-4000-8000-000000000013', 'Pending Before Delete');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);
select isnt_empty(
  $$delete from public.people where id = 'cccccccc-0000-4000-8000-000000000013' returning id$$,
  'admin deletes a person');
reset role;
select is(
  (select count(*)::int from public.change_requests where person_id = 'cccccccc-0000-4000-8000-000000000013'),
  0, 'deleting a person deletes their change requests');

-- updated_at trigger
select ok(
  (select updated_at >= created_at from public.people where id = 'cccccccc-0000-4000-8000-000000000011'),
  'updated_at is maintained');
select ok(
  not has_function_privilege('anon', 'public.approve_change_request(uuid, double precision, double precision, text, text)', 'execute'),
  'anon has no execute privilege on approve_change_request');

select * from finish();
rollback;
