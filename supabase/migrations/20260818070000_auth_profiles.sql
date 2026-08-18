alter table profiles
  add column if not exists auth_user_id uuid;

create unique index if not exists profiles_auth_user_id_idx
  on profiles (auth_user_id)
  where auth_user_id is not null;

comment on column profiles.auth_user_id is
  'Supabase Auth user id linked to this legacy device-key profile.';
