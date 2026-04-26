-- Add unique handle (@username) to profiles
alter table profiles add column if not exists handle text;

-- Enforce uniqueness and lowercase-only handles
create unique index if not exists profiles_handle_unique on profiles (lower(handle));

-- Validate handle format: 3-20 chars, lowercase alphanumeric + underscores, must start with letter
alter table profiles add constraint handle_format
  check (handle is null or handle ~ '^[a-z][a-z0-9_]{2,19}$');

-- Social links stored as JSONB
alter table profiles add column if not exists socials jsonb default '{}'::jsonb;
