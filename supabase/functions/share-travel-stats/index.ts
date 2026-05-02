/**
 * share-travel-stats — Serves animated travel constellation page.
 *
 * POST /share-travel-stats  → Create share token, return URL
 * GET  /share-travel-stats?token=xxx → Serve animated HTML page
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Destination {
  code: string;
  flag: string;
  x: number;
  y: number;
}

interface ConstellationData {
  destinations: Destination[];
  totalKm: number;
  since: string;
  trips: number;
  places: number;
  nights: number;
  spent: string;
}

const HOME = { x: 186.1, y: 99.7 };

function buildSvgNodes(data: ConstellationData): string {
  const lines = data.destinations.map((d, i) =>
    `<line class="c-line" x1="${HOME.x}" y1="${HOME.y}" x2="${d.x}" y2="${d.y}" style="animation-delay:${(0.1 + i * 0.1).toFixed(1)}s"></line>`
  ).join('\n');

  const homeNode = `
    <circle cx="${HOME.x}" cy="${HOME.y}" r="6.5" fill="#d8ab7a" opacity="0.35">
      <animate attributeName="r" values="6.5;10;6.5" dur="2.6s" repeatCount="indefinite"></animate>
      <animate attributeName="opacity" values="0.35;0.05;0.35" dur="2.6s" repeatCount="indefinite"></animate>
    </circle>
    <circle cx="${HOME.x}" cy="${HOME.y}" r="3.6" fill="#d8ab7a"></circle>
    <circle cx="${HOME.x}" cy="${HOME.y}" r="2" fill="#141210"></circle>
    <text class="c-label home" x="${HOME.x}" y="${HOME.y + 13}">HOME</text>`;

  const destNodes = data.destinations.map((d, i) => {
    const isBelow = ['HKG', 'SIN', 'BKK', 'DPS'].includes(d.code);
    const flagX = d.code === 'HKG' || d.code === 'DPS' ? d.x : d.x < HOME.x ? d.x : d.x + 28;
    const flagY = isBelow ? d.y + 16 : d.y - 8;
    const delay = (0.4 + i * 0.1).toFixed(2);
    const labelDelay = (0.5 + i * 0.1).toFixed(2);

    return `
      <g class="c-node" style="animation-delay:${delay}s">
        <circle class="c-dot-ring" cx="${d.x}" cy="${d.y}" r="3.4" opacity="0.4"></circle>
        <circle class="c-dot" cx="${d.x}" cy="${d.y}" r="2.2"></circle>
      </g>
      <g class="c-node-label" style="animation-delay:${labelDelay}s">
        <text class="c-label" x="${d.x}" y="${d.y - 15}">${d.code}</text>
        <text class="c-flag" x="${flagX}" y="${flagY}">${d.flag}</text>
      </g>`;
  }).join('\n');

  // Animated traveler dots
  const travelers = data.destinations.map((d, i) => {
    const begin = (1.4 + i * 0.85).toFixed(2);
    return `
      <circle class="c-traveler" r="1.8" opacity="0">
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.85;1" dur="1.4s" begin="${begin}s;t${i}.end+6s" id="t${i}"></animate>
        <animate attributeName="cx" from="${HOME.x}" to="${d.x}" dur="1.4s" begin="${begin}s;t${i}.end+6s" fill="freeze"></animate>
        <animate attributeName="cy" from="${HOME.y}" to="${d.y}" dur="1.4s" begin="${begin}s;t${i}.end+6s" fill="freeze"></animate>
      </circle>`;
  }).join('\n');

  return `${lines}\n${homeNode}\n${destNodes}\n${travelers}`;
}

function buildOgSvg(data: ConstellationData, displayName: string): string {
  const lines = data.destinations.map(d =>
    `<line x1="${HOME.x}" y1="${HOME.y}" x2="${d.x}" y2="${d.y}" stroke="#d8ab7a" stroke-width="1" stroke-dasharray="2.4 2.4" stroke-linecap="round" opacity="0.7"/>`
  ).join('');
  const dots = data.destinations.map(d =>
    `<circle cx="${d.x}" cy="${d.y}" r="2.2" fill="#f1ebe2"/>`
  ).join('');
  const labels = data.destinations.map(d =>
    `<text x="${d.x}" y="${d.y - 10}" fill="#b8afa3" font-size="5.5" font-weight="600" text-anchor="middle" font-family="-apple-system,sans-serif" letter-spacing="0.4">${d.code}</text>`
  ).join('');
  const flags = data.destinations.map(d => {
    const isBelow = ['HKG', 'SIN', 'BKK', 'DPS'].includes(d.code);
    const fx = d.code === 'HKG' || d.code === 'DPS' ? d.x : d.x < HOME.x ? d.x : d.x + 20;
    const fy = isBelow ? d.y + 14 : d.y - 6;
    return `<text x="${fx}" y="${fy}" font-size="12" text-anchor="middle" dominant-baseline="middle">${d.flag}</text>`;
  }).join('');

  const kmFormatted = data.totalKm.toLocaleString();
  const escapedName = escapeHtml(displayName);
  const escapedSpent = escapeHtml(data.spent);

  // 1200x630 is the standard OG image size
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
    <rect width="1200" height="630" fill="#141210"/>

    <!-- Card background -->
    <rect x="60" y="40" width="1080" height="550" rx="24" fill="#1f1b17" stroke="#2e2822" stroke-width="1"/>

    <!-- Header -->
    <text x="100" y="90" fill="#d8ab7a" font-size="14" font-weight="700" font-family="-apple-system,sans-serif" letter-spacing="2.5" text-transform="uppercase">LIFETIME · SINCE ${escapeHtml(data.since)}</text>
    <text x="100" y="132" fill="#f1ebe2" font-size="42" font-weight="600" font-family="-apple-system,sans-serif" letter-spacing="-1">${kmFormatted}</text>
    <text x="${100 + (kmFormatted.length * 25 + 10)}" y="132" fill="#b8afa3" font-size="18" font-weight="500" font-family="-apple-system,sans-serif">km traveled</text>

    <!-- Constellation map (scaled to fit card) -->
    <g transform="translate(120, 150) scale(2.6)">
      ${lines}
      <circle cx="${HOME.x}" cy="${HOME.y}" r="3.6" fill="#d8ab7a"/>
      <circle cx="${HOME.x}" cy="${HOME.y}" r="1.8" fill="#141210"/>
      <text x="${HOME.x}" y="${HOME.y + 10}" fill="#f1ebe2" font-size="5.5" font-weight="700" text-anchor="middle" font-family="-apple-system,sans-serif" letter-spacing="0.4">HOME</text>
      ${dots}
      ${labels}
      ${flags}
    </g>

    <!-- Stats bar -->
    <line x1="100" y1="500" x2="1100" y2="500" stroke="#3e362e" stroke-width="1" stroke-dasharray="4 4"/>
    <text x="200" y="540" fill="#f1ebe2" font-size="28" font-weight="600" font-family="-apple-system,sans-serif" text-anchor="middle">${data.trips}</text>
    <text x="200" y="562" fill="#857d70" font-size="11" font-weight="600" font-family="-apple-system,sans-serif" text-anchor="middle" letter-spacing="1.5">TRIPS</text>
    <text x="440" y="540" fill="#f1ebe2" font-size="28" font-weight="600" font-family="-apple-system,sans-serif" text-anchor="middle">${data.places}</text>
    <text x="440" y="562" fill="#857d70" font-size="11" font-weight="600" font-family="-apple-system,sans-serif" text-anchor="middle" letter-spacing="1.5">PLACES</text>
    <text x="680" y="540" fill="#f1ebe2" font-size="28" font-weight="600" font-family="-apple-system,sans-serif" text-anchor="middle">${data.nights}</text>
    <text x="680" y="562" fill="#857d70" font-size="11" font-weight="600" font-family="-apple-system,sans-serif" text-anchor="middle" letter-spacing="1.5">NIGHTS</text>
    <text x="920" y="540" fill="#f1ebe2" font-size="28" font-weight="600" font-family="-apple-system,sans-serif" text-anchor="middle">${escapedSpent}</text>
    <text x="920" y="562" fill="#857d70" font-size="11" font-weight="600" font-family="-apple-system,sans-serif" text-anchor="middle" letter-spacing="1.5">SPENT</text>

    <!-- Branding -->
    <text x="600" y="610" fill="#d8ab7a" font-size="11" font-weight="700" font-family="-apple-system,sans-serif" text-anchor="middle" letter-spacing="2.5">AFTERSTAY</text>
  </svg>`;
}

function buildPage(data: ConstellationData, displayName: string): string {
  const svgContent = buildSvgNodes(data);
  const kmFormatted = data.totalKm.toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${displayName}'s Travel Constellation — AfterStay</title>
<meta property="og:title" content="${displayName}'s Travel Constellation">
<meta property="og:description" content="${data.trips} trips · ${data.places} places · ${data.nights} nights · ${data.spent} spent">
<meta property="og:type" content="website">
<meta property="og:image" content="${Deno.env.get('SUPABASE_URL')}/functions/v1/share-travel-stats?token=OG_TOKEN_PLACEHOLDER&og=1">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${Deno.env.get('SUPABASE_URL')}/functions/v1/share-travel-stats?token=OG_TOKEN_PLACEHOLDER&og=1">
<style>
  :root{--bg:#141210;--card:#1f1b17;--border:#2e2822;--border2:#3e362e;--text:#f1ebe2;--text2:#b8afa3;--text3:#857d70;--accent:#d8ab7a}
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);min-height:100vh}
  body{font-family:-apple-system,"SF Pro Text",system-ui,sans-serif;color:var(--text);display:flex;align-items:center;justify-content:center;padding:24px 16px;flex-direction:column;gap:24px}
  .stage{width:100%;max-width:380px}
  .constellation{background:var(--card);border:1px solid var(--border);border-radius:18px;overflow:hidden}
  .constellation .head{padding:16px 18px 4px}
  .constellation .eyebrow{font-size:10px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;color:var(--accent)}
  .constellation .km{display:flex;align-items:baseline;gap:6px;margin-top:2px}
  .constellation .km .n{font-size:30px;font-weight:600;color:var(--text);letter-spacing:-0.8px;font-variant-numeric:tabular-nums}
  .constellation .km .u{font-size:13px;color:var(--text2);font-weight:500}
  .constellation .map{padding:6px 6px 4px}
  .constellation .map svg{display:block;width:100%;height:auto}
  .c-line{fill:none;stroke:var(--accent);stroke-width:1;stroke-dasharray:2.4 2.4;opacity:0.7;stroke-linecap:round}
  .c-dot{fill:#f1ebe2}
  .c-dot-ring{fill:none;stroke:var(--accent);stroke-width:1.2}
  .c-label{font-family:-apple-system,system-ui;font-size:6.5px;fill:var(--text2);font-weight:600;letter-spacing:0.5px;text-anchor:middle}
  .c-label.home{fill:var(--text);font-weight:700}
  .c-flag{font-size:22px;text-anchor:middle;dominant-baseline:middle}
  .c-traveler{fill:var(--accent);filter:drop-shadow(0 0 4px rgba(216,171,122,0.9))}
  .constellation .footer{border-top:1px dashed var(--border2);margin:6px 18px 0;display:grid;grid-template-columns:repeat(4,1fr);padding:12px 0 14px}
  .constellation .fcell{display:flex;flex-direction:column;align-items:center;gap:3px;border-right:1px solid var(--border)}
  .constellation .fcell:last-child{border-right:none}
  .constellation .fcell .v{font-size:18px;font-weight:600;color:var(--text);letter-spacing:-0.3px;font-variant-numeric:tabular-nums}
  .constellation .fcell .l{font-size:9.5px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--text3)}
  @keyframes drawLine{from{stroke-dashoffset:200;opacity:0}to{stroke-dashoffset:0;opacity:0.7}}
  @keyframes popDot{0%{transform:scale(0);opacity:0}60%{transform:scale(1.3)}100%{transform:scale(1);opacity:1}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:translateY(0)}}
  .c-line{stroke-dasharray:2.4 2.4;animation:drawLine 1.4s ease-out forwards}
  .c-node{transform-origin:center;transform-box:fill-box;animation:popDot .5s cubic-bezier(.5,1.6,.4,1) backwards}
  .c-node-label{animation:fadeIn .5s ease-out backwards}
  .branding{text-align:center;padding:8px 0 24px}
  .brand-name{font-size:11px;font-weight:700;letter-spacing:2.5px;color:var(--accent);text-transform:uppercase}
  .brand-sub{font-size:12px;color:var(--text3);margin-top:4px}
  .cta{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#0a0806;font-size:14px;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;margin-top:16px;transition:transform .2s}
  .cta:hover{transform:scale(1.03)}
  .user-line{font-size:14px;color:var(--text2);font-weight:500;text-align:center}
  .replay{margin:10px auto 0;display:block;background:transparent;border:1px solid var(--border2);color:var(--text2);font-size:10px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;padding:8px 14px;border-radius:999px;cursor:pointer}
  .replay:hover{color:var(--accent);border-color:var(--accent)}
</style>
</head>
<body>
  <div class="user-line">${escapeHtml(displayName)}'s travel constellation</div>
  <div class="stage" id="stage">
    <div class="constellation">
      <div class="head">
        <div class="eyebrow">Lifetime &middot; since ${escapeHtml(data.since)}</div>
        <div class="km"><span class="n">${kmFormatted}</span><span class="u">km traveled</span></div>
      </div>
      <div class="map">
        <svg viewBox="0 0 360 200" xmlns="http://www.w3.org/2000/svg">
          ${svgContent}
        </svg>
      </div>
      <div class="footer">
        <div class="fcell"><div class="v">${data.trips}</div><div class="l">Trips</div></div>
        <div class="fcell"><div class="v">${data.places}</div><div class="l">Places</div></div>
        <div class="fcell"><div class="v">${data.nights}</div><div class="l">Nights</div></div>
        <div class="fcell"><div class="v">${escapeHtml(data.spent)}</div><div class="l">Spent</div></div>
      </div>
    </div>
  </div>
  <button class="replay" onclick="(function(){var s=document.getElementById('stage');var c=s.innerHTML;s.innerHTML='';setTimeout(function(){s.innerHTML=c},50)})()">Replay animation</button>
  <div class="branding">
    <div class="brand-name">afterStay</div>
    <div class="brand-sub">Your travel companion</div>
    <a class="cta" href="https://afterstay.travel">Get AfterStay</a>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ── GET: Serve animated page or OG image ──
  if (req.method === 'GET') {
    const token = url.searchParams.get('token');
    const isOg = url.searchParams.get('og') === '1';
    if (!token) {
      return new Response('Missing token', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: share, error } = await supabase
      .from('travel_stat_shares')
      .select('data, display_name, expires_at')
      .eq('id', token)
      .single();

    if (error || !share) {
      return new Response('Share not found or expired', { status: 404 });
    }

    if (new Date(share.expires_at) < new Date()) {
      return new Response('This share link has expired', { status: 410 });
    }

    const displayName = share.display_name ?? 'A traveler';
    const constellationData = share.data as ConstellationData;

    // OG image: return static SVG
    if (isOg) {
      const svg = buildOgSvg(constellationData, displayName);
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // HTML page: replace OG token placeholder with actual token
    const page = buildPage(constellationData, displayName)
      .replaceAll('OG_TOKEN_PLACEHOLDER', token);
    return new Response(page, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // ── POST: Create share token ──
  if (req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { data: constellationData, displayName } = body;

    if (!constellationData) {
      return new Response(JSON.stringify({ error: 'Missing data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: share, error } = await supabase
      .from('travel_stat_shares')
      .upsert({
        user_id: user.id,
        data: constellationData,
        display_name: displayName ?? 'A traveler',
      }, { onConflict: 'user_id' })
      .select('id')
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const shareUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/share-travel-stats?token=${share.id}`;

    return new Response(JSON.stringify({ url: shareUrl, token: share.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
});
