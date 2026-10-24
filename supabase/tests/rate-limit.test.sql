-- Proves the fixed-window limiter allows N calls, refuses call N+1, isolates buckets and
-- fingerprints, supports refunds and purges stale rows.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

set local role service_role;

select ok(public.consume_rate_limit('test-bucket', 'fp-a', interval '15 minutes', 3), 'call 1 allowed');
select ok(public.consume_rate_limit('test-bucket', 'fp-a', interval '15 minutes', 3), 'call 2 allowed');
select ok(public.consume_rate_limit('test-bucket', 'fp-a', interval '15 minutes', 3), 'call 3 allowed');
select ok(not public.consume_rate_limit('test-bucket', 'fp-a', interval '15 minutes', 3), 'call 4 refused');
select is(
  (select count(*)::int from public.rate_limit_events where bucket = 'test-bucket' and fingerprint = 'fp-a'),
  3, 'a refused call is not recorded');
select ok(public.consume_rate_limit('test-bucket', 'fp-b', interval '15 minutes', 3), 'another fingerprint is independent');
select ok(public.consume_rate_limit('other-bucket', 'fp-a', interval '15 minutes', 3), 'another bucket is independent');

select lives_ok($$select public.refund_rate_limit('test-bucket', 'fp-a')$$, 'refund runs');
select ok(public.consume_rate_limit('test-bucket', 'fp-a', interval '15 minutes', 3), 'a refunded slot can be used again');

reset role;
insert into public.rate_limit_events (bucket, fingerprint, created_at)
values ('test-bucket', 'fp-old', now() - interval '2 days');
set local role service_role;
select ok(public.consume_rate_limit('test-bucket', 'fp-c', interval '15 minutes', 3), 'a call purges stale rows');
reset role;
select is(
  (select count(*)::int from public.rate_limit_events where fingerprint = 'fp-old'),
  0, 'rows older than one day are deleted');

select * from finish();
rollback;
