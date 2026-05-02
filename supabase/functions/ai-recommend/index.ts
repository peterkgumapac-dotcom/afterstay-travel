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
      const isOverviewCached = category === 'destination-overview';
      const cachedBody = isOverviewCached
        ? { overview: cached.items, cached: true }
        : { items: cached.items, cached: true };
      return new Response(JSON.stringify(cachedBody), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Build prompt based on category type
    const isOverview = category === 'destination-overview';
    const areaLabel = area ? ` in ${area}` : '';
    const hotelRef = hotelName ? ` The user is staying at ${hotelName}.` : '';

    const prompt = isOverview
      ? `You are a travel expert. Use web_search to find current information about visiting ${destination}.

Search for: "visiting ${destination} travel guide 2025 2026", "${destination} things to do", "${destination} budget travel cost"

Return ONLY a JSON object (no markdown, no explanation):
{
  "summary": "1-2 sentence overview of what makes ${destination} special for travelers",
  "highlights": ["Top thing to do 1", "Top thing 2", "Top thing 3", "Top thing 4", "Top thing 5"],
  "budgetRange": {
    "budget": "₱X-Y/day estimate for budget travelers",
    "mid": "₱X-Y/day for mid-range",
    "luxury": "₱X+/day for luxury"
  },
  "bestMonths": "Best months to visit and why (e.g. Nov-May, dry season)",
  "weatherNote": "Brief climate/weather note for travelers",
  "gettingThere": "Brief transport note on how to get there from Manila"
}

Use Philippine Peso (₱) for budget estimates. Only include verified information from web search.`
      : `You are a local travel expert for ${destination}. Use web_search to find REAL, currently-operating places.

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

Only include places you verified exist via web search. Do not hallucinate.`;

    // Call Claude with web_search
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
        messages: [{ role: 'user', content: prompt }],
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
    let parsed: unknown = null;
    for (const block of result.content ?? []) {
      if (block.type === 'text' && block.text) {
        // Try object first (destination-overview), then array (place list)
        const objMatch = block.text.match(/\{[\s\S]*\}/);
        const arrMatch = block.text.match(/\[[\s\S]*\]/);
        if (isOverview && objMatch) {
          try { parsed = JSON.parse(objMatch[0]); } catch { /* ignore */ }
        } else if (arrMatch) {
          try { parsed = JSON.parse(arrMatch[0]); } catch { /* ignore */ }
        }
      }
    }

    if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
      return new Response(JSON.stringify({ error: 'No results found', items: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Cache results — store the parsed data as `items` for both formats
    const expiresAt = new Date(Date.now() + CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('curated_lists').upsert({
      query_hash: qHash,
      destination,
      category,
      area: area ?? null,
      items: parsed,
      expires_at: expiresAt,
    }, { onConflict: 'query_hash' });

    const responseBody = isOverview
      ? { overview: parsed, cached: false }
      : { items: parsed as RecommendItem[], cached: false };

    return new Response(JSON.stringify(responseBody), {
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
