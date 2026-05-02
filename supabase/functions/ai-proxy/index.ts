/**
 * ai-proxy — Single Edge Function proxying all Anthropic API calls.
 * Keeps the API key server-side. Client sends { action, payload }.
 *
 * Actions: recommend, itinerary, receipt-scan, trip-scan, trip-memory, concierge
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514';

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
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
