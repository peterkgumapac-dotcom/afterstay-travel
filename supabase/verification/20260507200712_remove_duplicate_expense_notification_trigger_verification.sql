select
  exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'expenses'
      and trigger_name = 'expense_notification_trigger'
  ) as expense_notification_trigger_exists,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'handle_expense_notification'
  ) as handle_expense_notification_exists,
  exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table = 'notifications'
      and trigger_name = 'on_notification_insert'
  ) as notification_push_trigger_exists;
