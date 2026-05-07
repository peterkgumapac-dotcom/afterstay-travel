-- Expense-added notifications are sent by the app via notifyExpenseAdded(),
-- which also queues the push edge function. The older DB trigger inserts a
-- second in-app notification for the same expense, so remove that duplicate
-- source and leave push/in-app delivery in one client path.

drop trigger if exists expense_notification_trigger on public.expenses;
drop function if exists public.handle_expense_notification();
