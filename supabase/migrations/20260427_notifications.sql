-- Notifications table — stores in-app and push notification records.
-- Referenced by: lib/supabase.ts insertNotification(), hooks/useNotifications.ts,
--   supabase/functions/send-push-notification, supabase/functions/trip-lifecycle-notifications

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb default '{}'::jsonb,
  read boolean default false,
  push_sent boolean default false,
  created_at timestamptz default now()
);

-- Index for the primary query pattern: user's unread notifications, newest first
create index if not exists idx_notifications_user_read
  on notifications (user_id, read, created_at desc);

-- Index for real-time filter
create index if not exists idx_notifications_user_id
  on notifications (user_id);

-- RLS: users can only see and manage their own notifications
alter table notifications enable row level security;

create policy "users read own notifications"
  on notifications for select using (auth.uid() = user_id);

create policy "users update own notifications"
  on notifications for update using (auth.uid() = user_id);

-- Insert policy: allow the app (authenticated) to insert notifications for any user
-- This is needed because notifyAllMembers() inserts for other trip members
create policy "authenticated users can insert notifications"
  on notifications for insert with check (auth.role() = 'authenticated');

-- Allow service_role (Edge Functions) full access
create policy "service role full access"
  on notifications for all using (auth.role() = 'service_role');

-- Ensure profiles has notification-related columns
alter table profiles add column if not exists notification_prefs jsonb default '{}'::jsonb;
alter table profiles add column if not exists expo_push_token text;
alter table profiles add column if not exists push_enabled boolean default false;
