insert into public.app_settings (key, value)
values
  ('maintenance_duration_minutes', '30'),
  ('maintenance_started_at', '')
on conflict (key) do nothing;
