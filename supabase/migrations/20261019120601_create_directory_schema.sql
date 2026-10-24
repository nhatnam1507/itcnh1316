-- Directory schema: people, change requests and admins.
-- The browser never talks to Supabase. The Next.js server reads with the secret key
-- (service_role) after the class passcode check, and admins write through their own
-- session (authenticated role), so RLS enforces the admin check in the database too.

create type public.change_request_status as enum ('pending', 'approved', 'rejected');

create table public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null
    check (char_length(full_name) between 1 and 120 and full_name = btrim(full_name)),
  date_of_birth date not null
    check (date_of_birth >= date '1900-01-01' and date_of_birth <= current_date),
  -- Vietnamese mobile numbers only, normalized to +84 by the server.
  mobile_phone text not null
    check (mobile_phone ~ '^\+84(3|5|7|8|9)[0-9]{8}$'),
  address text not null
    check (char_length(address) between 5 and 300 and address = btrim(address)),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  location_source text check (location_source in ('geocoded', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_coordinates_paired check ((latitude is null) = (longitude is null)),
  constraint people_location_source_paired check ((latitude is null) = (location_source is null))
);

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  proposed_full_name text
    check (char_length(proposed_full_name) between 1 and 120 and proposed_full_name = btrim(proposed_full_name)),
  proposed_date_of_birth date
    check (proposed_date_of_birth >= date '1900-01-01' and proposed_date_of_birth <= current_date),
  proposed_mobile_phone text
    check (proposed_mobile_phone ~ '^\+84(3|5|7|8|9)[0-9]{8}$'),
  proposed_address text
    check (char_length(proposed_address) between 5 and 300 and proposed_address = btrim(proposed_address)),
  requester_note text check (char_length(requester_note) <= 500),
  status public.change_request_status not null default 'pending',
  previous_values jsonb,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text check (char_length(reviewer_note) <= 500),
  submitted_at timestamptz not null default now(),
  -- HMAC of the requester's IP; the raw IP is never stored.
  requester_fingerprint text,
  constraint change_requests_has_proposal check (
    num_nonnulls(proposed_full_name, proposed_date_of_birth, proposed_mobile_phone, proposed_address) >= 1
  ),
  constraint change_requests_reviewed_when_closed check ((status = 'pending') = (reviewed_at is null))
);

create index change_requests_status_submitted_idx on public.change_requests (status, submitted_at);
create index change_requests_person_idx on public.change_requests (person_id);
create index change_requests_reviewed_by_idx on public.change_requests (reviewed_by);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- updated_at maintenance
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger people_set_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();

-- Admin check used by RLS policies and the approval functions.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Row-level security: no policies for anon; authenticated callers only pass as admins.
alter table public.people enable row level security;
alter table public.change_requests enable row level security;
alter table public.admins enable row level security;

create policy "Admins can read people" on public.people
  for select to authenticated using ((select public.is_admin()));
create policy "Admins can insert people" on public.people
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins can update people" on public.people
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete people" on public.people
  for delete to authenticated using ((select public.is_admin()));

create policy "Admins can read change requests" on public.change_requests
  for select to authenticated using ((select public.is_admin()));
create policy "Admins can update change requests" on public.change_requests
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins can read their own admin row" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- Table privileges: nothing for anon; the minimum each admin policy needs for authenticated.
revoke all on public.people, public.change_requests, public.admins from anon, authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant select, update on public.change_requests to authenticated;
grant select on public.admins to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
