import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-20250514';
const CACHE_DAYS = 7;

interface RecommendItem {
  name: string;
  reason: string;
  source_url?: string;
  rating?: number;
  price?: string;
  category?: string;
}

function hashQuery(dest: string, category: string, area?: string): string {
  const raw = `${dest.toLowerCase().trim()}|${category.toLowerCase().trim()}|${(area ?? '').toLowerCase().trim()}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      },
    });
  }

  try {
    const { destination, category, area, hotelName, count } = await req.json() as {
      destination: string;
      category: string;
      area?: string;
      hotelName?: string;
      count?: number;
    };

    if (!destination || !category) {
      return new Response(JSON.stringify({ error: 'destination and category required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const qHash = hashQuery(destination, category, area);
    const n = count ?? 5;

    // Check cache
    const { data: cached } = await supabase
      .from('curated_lists')
      .select('items')
      .eq('query_hash', qHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached?.items) {
      return new Response(JSON.stringify({ items: cached.items, cached: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Call Claude with web_search
    const areaLabel = area ? ` in ${area}` : '';
    const hotelRef = hotelName ? ` The user is staying at ${hotelName}.` : '';

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [
          {
            role: 'user',
            content: `You are a local travel expert for ${destination}. Use web_search to find REAL, currently-operating places.

Search Reddit, TripAdvisor, Google, and travel blogs for: "best ${category}${areaLabel} ${destination} 2025 2026"

Task: Find the top ${n} ${category}${areaLabel}, ${destination}.${hotelRef}

For each place, include:
- name: exact name of the place (verified via search)
- reason: one sentence why it's recommended, citing the source
- source_url: URL where you found this recommendation
- rating: number 1-5 if available
- price: price range (e.g. "₱200-500/person")
- category: sub-category if relevant

Return ONLY a JSON array. No markdown, no explanation. Example:
[{"name":"Cafe Name","reason":"Recommended by Reddit users for their cold brew","source_url":"https://reddit.com/...","rating":4,"price":"₱150-300","category":"cafe"}]

Only include places you verified exist via web search. Do not hallucinate.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return new Response(JSON.stringify({ error: 'AI request failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const result = await response.json();

    // Extract JSON from Claude's response (may have text blocks + tool results)
    let items: RecommendItem[] = [];
    for (const block of result.content ?? []) {
      if (block.type === 'text' && block.text) {
        const jsonMatch = block.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            items = JSON.parse(jsonMatch[0]);
          } catch { /* ignore parse errors */ }
        }
      }
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: 'No results found', items: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Cache results
    const expiresAt = new Date(Date.now() + CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('curated_lists').upsert({
      query_hash: qHash,
      destination,
      category,
      area: area ?? null,
      items,
      expires_at: expiresAt,
    }, { onConflict: 'query_hash' });

    return new Response(JSON.stringify({ items, cached: false }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
