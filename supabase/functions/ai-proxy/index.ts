/**
 * ai-proxy — Single Edge Function proxying all Anthropic API calls.
 * Keeps the API key server-side. Client sends { action, payload }.
 *
 * Actions: recommend, itinerary, receipt-scan, trip-scan, trip-memory, concierge
 *
 * Rate limiting: each authenticated user is capped at AI_DAILY_CALL_LIMIT
 * successful calls per rolling 24h, tracked in the public.ai_call_log table.
 * The cap can be overridden per environment via the AI_DAILY_CALL_LIMIT env var.
 * Failures (auth errors, provider errors) are not counted.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514';

const DEFAULT_DAILY_CALL_LIMIT = 50;
const RATE_WINDOW_HOURS = 24;

function getDailyCallLimit(): number {
  const raw = Deno.env.get('AI_DAILY_CALL_LIMIT');
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_CALL_LIMIT;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit: count this user's calls in the last 24h. Use the service
    // role so the count and the eventual insert always succeed regardless of
    // RLS. If the table is missing or the query errors, log and fail-open
    // — better to serve the user than to brick AI globally on a typo, but
    // the error will surface in function logs immediately.
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey)
      : null;
    const dailyLimit = getDailyCallLimit();
    const windowStart = new Date(Date.now() - RATE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    if (adminClient) {
      const { count, error: countError } = await adminClient
        .from('ai_call_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', windowStart);
      if (countError) {
        console.warn('[ai-proxy] rate-limit count failed (failing open):', countError.message);
      } else if ((count ?? 0) >= dailyLimit) {
        return new Response(
          JSON.stringify({
            error: `Daily AI limit reached (${dailyLimit} calls / ${RATE_WINDOW_HOURS}h). Try again later.`,
            retryAfterHours: RATE_WINDOW_HOURS,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': String(RATE_WINDOW_HOURS * 60 * 60),
            },
          },
        );
      }
    }

    const { action, payload } = await req.json();

    // Build the Anthropic request based on action
    let anthropicBody: Record<string, unknown>;

    switch (action) {
      case 'recommend':
        anthropicBody = {
          model: MODEL,
          max_tokens: 4096,
          system: payload.system,
          messages: [{ role: 'user', content: payload.userMessage }],
        };
        break;

      case 'itinerary':
        anthropicBody = {
          model: MODEL,
          max_tokens: payload.maxTokens ?? 4096,
          system: payload.system,
          messages: [{ role: 'user', content: payload.userMessage }],
        };
        break;

      case 'receipt-scan':
        anthropicBody = {
          model: MODEL,
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: payload.mimeType ?? 'image/jpeg',
                  data: payload.base64Image,
                },
              },
              { type: 'text', text: payload.prompt },
            ],
          }],
        };
        break;

      case 'trip-scan':
        if (!Array.isArray(payload.imageBlocks) || payload.imageBlocks.length === 0) {
          return new Response(JSON.stringify({ error: 'No screenshots provided for trip scan' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        anthropicBody = {
          model: MODEL,
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: [
              ...payload.imageBlocks,
              { type: 'text', text: payload.prompt },
            ],
          }],
        };
        break;

      case 'trip-memory':
        anthropicBody = {
          model: MODEL,
          max_tokens: 4096,
          system: payload.system,
          messages: [{ role: 'user', content: payload.userMessage }],
        };
        break;

      case 'concierge':
        anthropicBody = {
          model: MODEL,
          max_tokens: 1024,
          system: payload.system,
          messages: [{ role: 'user', content: payload.userMessage }],
        };
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Call Anthropic
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!res.ok) {
      const body = await res.text();
      let message = body;
      let providerType: unknown;
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string; type?: unknown } | string };
        if (typeof parsed.error === 'string') message = parsed.error;
        else if (parsed.error?.message) message = parsed.error.message;
        providerType = typeof parsed.error === 'object' ? parsed.error?.type : undefined;
      } catch {
        // Keep raw body for non-JSON provider errors.
      }
      const status = /credit balance is too low/i.test(message) ? 402 : res.status;
      return new Response(JSON.stringify({
        error: message,
        providerStatus: res.status,
        providerType,
      }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text ?? '';

    // Log the successful call for rate limiting + auditability. We do not
    // await this — the user shouldn't pay latency for the audit write, and a
    // dropped log row is acceptable; over-counting is not.
    if (adminClient) {
      adminClient
        .from('ai_call_log')
        .insert({
          user_id: user.id,
          action,
          tokens_in: data?.usage?.input_tokens ?? null,
          tokens_out: data?.usage?.output_tokens ?? null,
        })
        .then(({ error: insertError }) => {
          if (insertError) {
            console.warn('[ai-proxy] failed to log call:', insertError.message);
          }
        });
    }

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
