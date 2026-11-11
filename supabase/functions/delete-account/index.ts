import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IGNORABLE_DB_ERROR_CODES = new Set([
  '42P01',
  '42703',
  'PGRST204',
]);

const USER_DATA_DELETES: Array<{ table: string; column: string }> = [
  { table: 'ai_call_log', column: 'user_id' },
  { table: 'album_members', column: 'user_id' },
  { table: 'albums', column: 'user_id' },
  { table: 'chat_messages', column: 'user_id' },
  { table: 'companions', column: 'user_id' },
  { table: 'companions', column: 'companion_id' },
  { table: 'expense_payments', column: 'user_id' },
  { table: 'expense_splits', column: 'user_id' },
  { table: 'expenses', column: 'user_id' },
  { table: 'feed_post_comments', column: 'user_id' },
  { table: 'feed_post_likes', column: 'user_id' },
  { table: 'feed_posts', column: 'user_id' },
  { table: 'follows', column: 'follower_id' },
  { table: 'follows', column: 'following_id' },
  { table: 'group_members', column: 'user_id' },
  { table: 'highlights', column: 'user_id' },
  { table: 'lifetime_stats', column: 'user_id' },
  { table: 'moment_comments', column: 'user_id' },
  { table: 'moment_dismissals', column: 'user_id' },
  { table: 'moment_favorites', column: 'user_id' },
  { table: 'moment_views', column: 'user_id' },
  { table: 'moments', column: 'user_id' },
  { table: 'notifications', column: 'user_id' },
  { table: 'personal_photos', column: 'user_id' },
  { table: 'post_saves', column: 'user_id' },
  { table: 'post_tags', column: 'tagged_by_user_id' },
  { table: 'post_tags', column: 'tagged_user_id' },
  { table: 'profile_travel_places', column: 'user_id' },
  { table: 'quick_trip_companions', column: 'user_id' },
  { table: 'quick_trip_expenses', column: 'created_by_user_id' },
  { table: 'quick_trip_media', column: 'user_id' },
  { table: 'quick_trips', column: 'created_by_user_id' },
  { table: 'savings_goals', column: 'user_id' },
  { table: 'travel_stat_shares', column: 'user_id' },
  { table: 'trip_files', column: 'user_id' },
  { table: 'trip_memories', column: 'user_id' },
  { table: 'trips', column: 'user_id' },
  { table: 'user_achievements', column: 'user_id' },
  { table: 'user_payment_qrs', column: 'user_id' },
  { table: 'wishlist', column: 'user_id' },
  { table: 'profiles', column: 'id' },
];

type PostgrestLikeError = {
  code?: string;
  message?: string;
};

function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isIgnorableDbError(error: PostgrestLikeError): boolean {
  return !!error.code && IGNORABLE_DB_ERROR_CODES.has(error.code);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const token = bearerToken(req);
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Delete account is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const hardFailures: string[] = [];

    for (const { table, column } of USER_DATA_DELETES) {
      const { error } = await adminClient.from(table).delete().eq(column, user.id);
      if (error && !isIgnorableDbError(error)) {
        hardFailures.push(`${table}.${column}: ${error.message ?? error.code ?? 'unknown error'}`);
      }
    }

    if (hardFailures.length > 0) {
      return new Response(JSON.stringify({ error: 'Account data cleanup failed', details: hardFailures }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
