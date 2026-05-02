/**
 * places-proxy — Edge Function proxying all Google Places API calls.
 * Keeps the API key server-side. Client sends { action, payload }.
 *
 * Actions: search, nearby, details, location, autocomplete, photo
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing auth' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      return jsonResponse({ error: 'Places service not configured' }, 500);
    }

    const { action, payload } = await req.json();

    switch (action) {
      case 'search': {
        const { query, fields } = payload;
        const encodedQuery = encodeURIComponent(query);
        const f = fields || 'place_id,name,formatted_address,rating,user_ratings_total,photos,geometry';
        const url = `${PLACES_BASE}/findplacefromtext/json?input=${encodedQuery}&inputtype=textquery&fields=${f}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        return jsonResponse(data);
      }

      case 'nearby': {
        const { lat, lng, radius, type, keyword, pagetoken } = payload;
        const params = new URLSearchParams({
          location: `${lat},${lng}`,
          radius: String(radius || 5000),
          key: apiKey,
        });
        if (type) params.append('type', type);
        if (keyword) params.append('keyword', keyword);
        if (pagetoken) params.append('pagetoken', pagetoken);
        const url = `${PLACES_BASE}/nearbysearch/json?${params}`;
        const res = await fetch(url);
        const data = await res.json();

        // Resolve photo URLs server-side (eliminates 20 client round trips)
        const results = data.results ?? [];
        const enriched = await Promise.all(
          results.map(async (place: any) => {
            const photos: any[] = place.photos ?? [];
            let resolved_photo_url: string | null = null;
            if (photos.length > 0) {
              // Pick best landscape photo from first 5 candidates
              const candidates = photos.slice(0, 5);
              const landscape = candidates.find((p: any) => (p.width ?? 0) > (p.height ?? 0));
              const best = landscape ?? photos[0];
              const ref = best?.photo_reference;
              if (ref) {
                try {
                  const photoUrl = `${PLACES_BASE}/photo?maxwidth=800&photo_reference=${ref}&key=${apiKey}`;
                  const photoRes = await fetch(photoUrl, { redirect: 'follow' });
                  resolved_photo_url = photoRes.url;
                } catch { /* photo resolution failed — leave null */ }
              }
            }
            return { ...place, resolved_photo_url };
          }),
        );

        // Fetch editorial summaries for top 8 results (by quality score)
        const scored = enriched
          .map((p: any, i: number) => ({
            idx: i,
            score: (p.rating ?? 0) * Math.log10(Math.max(p.user_ratings_total ?? 1, 1)),
          }))
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 8);

        await Promise.all(
          scored.map(async ({ idx }: { idx: number }) => {
            const pid = enriched[idx]?.place_id;
            if (!pid) return;
            try {
              const detUrl = `${PLACES_BASE}/details/json?place_id=${pid}&fields=editorial_summary&key=${apiKey}`;
              const detRes = await fetch(detUrl);
              const det = await detRes.json();
              enriched[idx].editorial_summary = det?.result?.editorial_summary?.overview ?? null;
            } catch { /* non-fatal */ }
          }),
        );

        return jsonResponse({
          results: enriched,
          next_page_token: data.next_page_token ?? null,
          status: data.status,
        });
      }

      case 'details': {
        const { placeId, fields } = payload;
        const f = fields || 'name,rating,formatted_phone_number,formatted_address,opening_hours,reviews,photos,website,url,price_level,editorial_summary';
        const url = `${PLACES_BASE}/details/json?place_id=${placeId}&fields=${f}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        return jsonResponse(data);
      }

      case 'location': {
        const { placeId } = payload;
        const url = `${PLACES_BASE}/details/json?place_id=${placeId}&fields=name,geometry&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        return jsonResponse(data);
      }

      case 'autocomplete': {
        const { input, lat, lng } = payload;
        const params = new URLSearchParams({
          input: input.trim(),
          key: apiKey,
        });
        if (lat && lng) {
          params.append('location', `${lat},${lng}`);
          params.append('radius', '5000');
        }
        const url = `${PLACES_BASE}/autocomplete/json?${params}`;
        const res = await fetch(url);
        const data = await res.json();
        return jsonResponse(data);
      }

      case 'photo': {
        const { photoReference, maxWidth } = payload;
        const url = `${PLACES_BASE}/photo?maxwidth=${maxWidth || 800}&photo_reference=${photoReference}&key=${apiKey}`;
        // Google redirects to the actual image — return the final URL
        const res = await fetch(url, { redirect: 'follow' });
        return jsonResponse({ url: res.url });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
