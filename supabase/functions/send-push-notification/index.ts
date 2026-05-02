import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function base64Url(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n');
  const base64 = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getFirebaseAccessToken(): Promise<string | null> {
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedJwt),
  );
  const assertion = `${unsignedJwt}.${base64Url(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.access_token) return null;
  return json.access_token as string;
}

function stringifyData(data: Record<string, unknown> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    ]),
  );
}

serve(async (req) => {
  try {
    const { type, record } = await req.json();
    if (type !== 'INSERT') return new Response('Skipped', { status: 200 });
    if (!record?.id || !record?.user_id || !record?.title) {
      return new Response('Missing notification fields', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('fcm_token, expo_push_token, push_provider, push_enabled, notification_prefs')
      .eq('id', record.user_id)
      .single();

    if ((!profile?.fcm_token && !profile?.expo_push_token) || !profile.push_enabled) {
      return new Response('No token', { status: 200 });
    }

    // Quiet hours check — suppress push but keep DB notification for in-app display
    const prefs = (profile.notification_prefs as Record<string, unknown>) ?? {};
    const quietHours = prefs.quietHours as { enabled?: boolean; startHour?: number; endHour?: number } | undefined;
    if (quietHours?.enabled) {
      const phtHour = (new Date().getUTCHours() + 8) % 24;
      const start = quietHours.startHour ?? 22;
      const end = quietHours.endHour ?? 7;
      const inQuietWindow = start > end
        ? (phtHour >= start || phtHour < end)
        : (phtHour >= start && phtHour < end);
      if (inQuietWindow) {
        return new Response('Quiet hours', { status: 200 });
      }
    }

    if (profile.fcm_token) {
      const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID');
      const accessToken = await getFirebaseAccessToken();
      if (firebaseProjectId && accessToken) {
        const fcmResponse = await fetch(
          `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              message: {
                token: profile.fcm_token,
                notification: {
                  title: `AfterStay · ${record.title}`,
                  body: record.body,
                },
                data: stringifyData(record.data ?? {}),
                android: {
                  priority: 'HIGH',
                  notification: {
                    channel_id: 'afterstay',
                    sound: 'default',
                  },
                },
                apns: {
                  payload: {
                    aps: {
                      sound: 'default',
                    },
                  },
                },
              },
            }),
          },
        );
        const fcmJson = await fcmResponse.json().catch(() => null);
        if (fcmResponse.ok) {
          await supabase.from('notifications').update({ push_sent: true }).eq('id', record.id);
          return new Response(JSON.stringify({ ok: true, provider: 'firebase', ticket: fcmJson }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const errorStatus = fcmJson?.error?.status as string | undefined;
        if (errorStatus === 'UNREGISTERED' || errorStatus === 'INVALID_ARGUMENT') {
          await supabase
            .from('profiles')
            .update({ fcm_token: null, push_provider: profile.expo_push_token ? 'expo' : 'firebase' })
            .eq('id', record.user_id);
        }

        if (!profile.expo_push_token) {
          return new Response(JSON.stringify({
            ok: false,
            provider: 'firebase',
            error: fcmJson?.error?.message ?? 'FCM push rejected',
            code: errorStatus,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.expo_push_token,
        sound: 'default',
        title: `AfterStay · ${record.title}`,
        body: record.body,
        data: record.data ?? {},
        channelId: 'afterstay',
        priority: 'high',
        ttl: 3600,
      }),
    });

    const expoJson = await expoResponse.json().catch(() => null);
    const ticket = Array.isArray(expoJson?.data) ? expoJson.data[0] : expoJson?.data;
    const pushError = !expoResponse.ok || ticket?.status === 'error';

    if (pushError) {
      const errorCode = ticket?.details?.error;
      if (errorCode === 'DeviceNotRegistered') {
        await supabase
          .from('profiles')
          .update({ expo_push_token: null, push_enabled: !!profile.fcm_token })
          .eq('id', record.user_id);
      }
      return new Response(JSON.stringify({
        ok: false,
        status: expoResponse.status,
        error: ticket?.message ?? expoJson?.errors?.[0]?.message ?? 'Expo push rejected',
        code: errorCode,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('notifications').update({ push_sent: true }).eq('id', record.id);

    return new Response(JSON.stringify({ ok: true, provider: 'expo', ticket }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
});
