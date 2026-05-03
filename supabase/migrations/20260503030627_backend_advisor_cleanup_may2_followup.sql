-- Follow-up advisor cleanup.
-- Keeps internal trigger/helper functions off anonymous RPC access and pins
-- search_path for functions that advisors flagged as mutable.

revoke execute on function public.update_feed_post_comments_count() from anon;
revoke execute on function public.update_feed_post_comments_count() from public;
revoke execute on function public.update_feed_post_likes_count() from anon;
revoke execute on function public.update_feed_post_likes_count() from public;
revoke execute on function public.update_feed_post_save_count() from anon;
revoke execute on function public.update_feed_post_save_count() from public;
revoke execute on function public.update_feed_post_share_count() from anon;
revoke execute on function public.update_feed_post_share_count() from public;
revoke execute on function public.update_moment_comments_count() from anon;
revoke execute on function public.update_moment_comments_count() from public;
revoke execute on function public.update_moment_likes_count() from anon;
revoke execute on function public.update_moment_likes_count() from public;

alter function public.handle_member_joined_notification() set search_path = public;
alter function public.handle_updated_at() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.compute_user_segment(uuid) set search_path = public;
alter function public.update_user_segment() set search_path = public;
alter function public.auto_add_companions() set search_path = public;
alter function public.notify_push_on_insert() set search_path = public;
alter function public.handle_expense_notification() set search_path = public;
