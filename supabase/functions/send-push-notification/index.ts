import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const { type, record } = await req.json();
    if (type !== 'INSERT') return new Response('Skipped', { status: 200 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('expo_push_token, push_enabled')
      .eq('id', record.user_id)
      .single();

    if (!profile?.expo_push_token || !profile.push_enabled) {
      return new Response('No token', { status: 200 });
    }

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.expo_push_token,
        sound: 'default',
        title: record.title,
        body: record.body,
        data: record.data ?? {},
        channelId: 'default',
      }),
    });

    await supabase.from('notifications').update({ push_sent: true }).eq('id', record.id);

    return new Response('OK', { status: 200 });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
});
