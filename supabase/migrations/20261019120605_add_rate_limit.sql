-- Fixed-window rate limiting keyed by an HMAC fingerprint of the client IP.
-- Only the server (service_role) can call these functions.

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null check (char_length(bucket) between 1 and 64),
  fingerprint text not null check (char_length(fingerprint) between 1 and 128),
  created_at timestamptz not null default now()
);

create index rate_limit_events_lookup_idx
  on public.rate_limit_events (bucket, fingerprint, created_at);

alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from anon, authenticated;

-- Records one attempt and returns true while the caller is under p_max attempts in
-- p_window; returns false (without recording) once the limit is reached.
create function public.consume_rate_limit(
  p_bucket text,
  p_fingerprint text,
  p_window interval,
  p_max int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  -- Serialize concurrent attempts from the same fingerprint so bursts cannot overshoot.
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_fingerprint, 0));

  delete from public.rate_limit_events where created_at < now() - interval '1 day';

  select count(*) into v_count
  from public.rate_limit_events
  where bucket = p_bucket
    and fingerprint = p_fingerprint
    and created_at > now() - p_window;

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_events (bucket, fingerprint) values (p_bucket, p_fingerprint);
  return true;
end;
$$;

-- Removes the newest recorded attempt, so a bucket can count only failed attempts
-- (consume before the check, refund after a success).
create function public.refund_rate_limit(p_bucket text, p_fingerprint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limit_events
  where id = (
    select id from public.rate_limit_events
    where bucket = p_bucket and fingerprint = p_fingerprint
    order by created_at desc, id desc
    limit 1
  );
$$;

revoke execute on function public.consume_rate_limit(text, text, interval, int) from public, anon, authenticated;
revoke execute on function public.refund_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, interval, int) to service_role;
grant execute on function public.refund_rate_limit(text, text) to service_role;
