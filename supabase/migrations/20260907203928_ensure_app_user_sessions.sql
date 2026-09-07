create table if not exists public.app_user_sessions (
  id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  page_views integer not null default 1 check (page_views >= 1),
  last_path text not null default '/' check (char_length(last_path) between 1 and 240)
);

create index if not exists app_user_sessions_profile_started_idx
  on public.app_user_sessions (profile_id, started_at desc);

create index if not exists app_user_sessions_started_idx
  on public.app_user_sessions (started_at desc);

create index if not exists app_user_sessions_last_seen_idx
  on public.app_user_sessions (last_seen_at desc);

alter table public.app_user_sessions enable row level security;
revoke all on table public.app_user_sessions from anon, authenticated;
