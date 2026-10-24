-- Atomic review of change requests. Both functions run as the definer, check
-- is_admin() for the calling session themselves, and lock the request row so two
-- admins cannot review the same request twice.

create function public.approve_change_request(
  p_request_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_location_source text default null,
  p_reviewer_note text default null
)
returns public.people
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.change_requests;
  v_person public.people;
  v_previous jsonb := '{}'::jsonb;
  v_address_changed boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_request
  from public.change_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'change request not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'change request is not pending' using errcode = '55000';
  end if;

  select * into v_person
  from public.people
  where id = v_request.person_id
  for update;

  v_address_changed := v_request.proposed_address is not null;

  if v_address_changed then
    if (p_latitude is null) <> (p_longitude is null) then
      raise exception 'latitude and longitude must be set together' using errcode = '22023';
    end if;
    if p_latitude is not null and p_location_source is distinct from 'geocoded'
       and p_location_source is distinct from 'manual' then
      raise exception 'location source must be geocoded or manual' using errcode = '22023';
    end if;
  end if;

  if v_request.proposed_full_name is not null then
    v_previous := v_previous || jsonb_build_object('full_name', v_person.full_name);
  end if;
  if v_request.proposed_date_of_birth is not null then
    v_previous := v_previous || jsonb_build_object('date_of_birth', v_person.date_of_birth);
  end if;
  if v_request.proposed_mobile_phone is not null then
    v_previous := v_previous || jsonb_build_object('mobile_phone', v_person.mobile_phone);
  end if;
  if v_address_changed then
    v_previous := v_previous || jsonb_build_object(
      'address', v_person.address,
      'latitude', v_person.latitude,
      'longitude', v_person.longitude,
      'location_source', v_person.location_source
    );
  end if;

  update public.people
  set
    full_name = coalesce(v_request.proposed_full_name, full_name),
    date_of_birth = coalesce(v_request.proposed_date_of_birth, date_of_birth),
    mobile_phone = coalesce(v_request.proposed_mobile_phone, mobile_phone),
    address = coalesce(v_request.proposed_address, address),
    latitude = case when v_address_changed then p_latitude else latitude end,
    longitude = case when v_address_changed then p_longitude else longitude end,
    location_source = case
      when not v_address_changed then location_source
      when p_latitude is null then null
      else p_location_source
    end
  where id = v_person.id
  returning * into v_person;

  update public.change_requests
  set
    status = 'approved',
    previous_values = v_previous,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewer_note = nullif(btrim(p_reviewer_note), '')
  where id = p_request_id;

  return v_person;
end;
$$;

create function public.reject_change_request(
  p_request_id uuid,
  p_reviewer_note text default null
)
returns public.change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.change_requests;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_request
  from public.change_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'change request not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'change request is not pending' using errcode = '55000';
  end if;

  update public.change_requests
  set
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewer_note = nullif(btrim(p_reviewer_note), '')
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke execute on function public.approve_change_request(uuid, double precision, double precision, text, text)
  from public, anon;
revoke execute on function public.reject_change_request(uuid, text) from public, anon;
grant execute on function public.approve_change_request(uuid, double precision, double precision, text, text)
  to authenticated;
grant execute on function public.reject_change_request(uuid, text) to authenticated;
