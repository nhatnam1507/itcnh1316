-- Local and CI seed data only. `supabase db push` never applies this file.
-- Every person below is fictional.

insert into public.people (id, full_name, date_of_birth, mobile_phone, address, latitude, longitude, location_source)
values
  ('11111111-1111-4111-8111-000000000001', 'Nguyễn Văn Ảo', '1998-03-14', '+84912000001',
   'Hồ Hoàn Kiếm, Hoàn Kiếm, Hà Nội', 21.0287, 105.8524, 'geocoded'),
  ('11111111-1111-4111-8111-000000000002', 'Trần Thị Mẫu', '1998-07-02', '+84387000002',
   'Chợ Bến Thành, Quận 1, TP. Hồ Chí Minh', 10.7725, 106.6980, 'manual'),
  ('11111111-1111-4111-8111-000000000003', 'Lê Hoàng Thử', '1997-11-23', '+84705000003',
   'Cầu Rồng, Hải Châu, Đà Nẵng', 16.0611, 108.2270, 'geocoded'),
  ('11111111-1111-4111-8111-000000000004', 'Phạm Minh Giả', '1998-01-30', '+84983000004',
   'Đại Nội, Thuận Hóa, Huế', 16.4698, 107.5776, 'geocoded'),
  ('11111111-1111-4111-8111-000000000005', 'Võ Ngọc Mô Phỏng', '1998-05-09', '+84563000005',
   'Bến Ninh Kiều, Ninh Kiều, Cần Thơ', 10.0340, 105.7880, 'manual'),
  ('11111111-1111-4111-8111-000000000006', 'Đặng Quốc Chưa Định Vị', '1997-09-17', '+84868000006',
   'Một địa chỉ chưa xác định, Hải Phòng', null, null, null);

-- Local-only test accounts for development and e2e tests. Never present in production.
--   admin@classnet.test / local-admin-password   (admin)
--   viewer@classnet.test / local-viewer-password (test-only: a valid Auth account with no admins row,
--     used by e2e/admin-access.spec.ts to prove the admin login refuses it. Classmates have no
--     accounts; they unlock with the class passcode.)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'authenticated', 'authenticated',
   'admin@classnet.test', extensions.crypt('local-admin-password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001', 'authenticated', 'authenticated',
   'viewer@classnet.test', extensions.crypt('local-viewer-password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u
where u.email in ('admin@classnet.test', 'viewer@classnet.test');

insert into public.admins (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001');
