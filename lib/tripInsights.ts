// Notion-specific trip insights module — disabled during Supabase migration.
// All functions return empty/default values to prevent crashes.

export interface NewsItem {
  date: string;         // "Apr 14, 2026" format
  dateISO: string;      // "2026-04-14"
  title: string;
  summary: string;
  sourceUrl?: string;
  sourceName?: string;  // "Philippine Star"
}

export interface TripInsight {
  summary: string;           // 1-sentence overall vibe
  newsItems: NewsItem[];
  fetchedAt: string;         // ISO timestamp
  expiresAt: string;         // ISO, 24hr later
}

/*
// --- Notion-specific code disabled during Supabase migration ---

import { CONFIG } from './config';

// Check Notion cache first
const fetchCachedInsight = async (): Promise<TripInsight | null> => {
  try {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${CONFIG.NOTION_DBS.TRIP_INSIGHTS}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.NOTION_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            property: 'Trip',
            title: { equals: 'Boracay April 2026' },
          },
          sorts: [{ property: 'Last Fetched', direction: 'descending' }],
          page_size: 1,
        }),
      }
    );
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    const row = data.results[0];
    const expiresAt = row.properties['Expires At']?.date?.start;
    if (!expiresAt) return null;

    // Expired? Return null to force refresh
    if (new Date(expiresAt) < new Date()) {
      // console.log('[Insights] Cache expired');
      return null;
    }

    const summary = row.properties.Summary?.rich_text?.[0]?.plain_text || '';
    const newsJSON = row.properties['News Items JSON']?.rich_text?.[0]?.plain_text || '[]';

    let newsItems: NewsItem[] = [];
    try {
      newsItems = JSON.parse(newsJSON);
    } catch {}

    return {
      summary,
      newsItems,
      fetchedAt: row.properties['Last Fetched']?.date?.start,
      expiresAt,
    };
  } catch (e) {
    console.error('[Insights] Cache fetch error:', e);
    return null;
  }
};

// Claude web_search to get real dated news
const generateFreshInsight = async (): Promise<TripInsight> => {
  // console.log('[Insights] Calling Claude with web_search...');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const prompt = `I'm traveling to Boracay, Philippines Apr 20-27, 2026. Search the web and find REAL, DATED news and updates about Boracay from the last 14 days (${twoWeeksAgo} to ${todayStr}).

Return ONLY a JSON object in this exact format (no other text):
{
  "summary": "One sentence about what's happening in Boracay right now",
  "newsItems": [
    {
      "dateISO": "2026-04-14",
      "date": "Apr 14, 2026",
      "title": "Headline-style title of the news",
      "summary": "1-2 sentence summary of what happened",
      "sourceUrl": "https://...",
      "sourceName": "Source name"
    }
  ]
}

Requirements:
- Every item MUST have a verifiable publication date from the search results
- Focus on: tourism advisories, weather events, new openings (restaurants/hotels/attractions), ferry schedule changes, island-wide news, events/festivals
- Skip generic tourism promotion content
- Maximum 5 items, most recent first
- If no news in the last 14 days, return empty newsItems array and say so in summary
- Respond with ONLY the JSON, no markdown code blocks, no preamble`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': CONFIG.ANTHROPIC_KEY,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  // console.log('[Insights] Claude response:', JSON.stringify(data).slice(0, 300));

  if (data.error) {
    throw new Error(`Claude error: ${data.error.message}`);
  }

  // Extract text from content blocks (may include tool_use and text)
  const textBlocks = (data.content || []).filter((b: any) => b.type === 'text');
  const combinedText = textBlocks.map((b: any) => b.text).join('');

  // Parse JSON out (Claude sometimes adds fences)
  const jsonMatch = combinedText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON in Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    summary: parsed.summary || 'No recent news found',
    newsItems: parsed.newsItems || [],
    fetchedAt: new Date().toISOString(),
    expiresAt,
  };
};

// Save to Notion cache
const saveInsightToCache = async (insight: TripInsight): Promise<void> => {
  try {
    // Delete old entry first (keep DB small)
    const existing = await fetch(
      `https://api.notion.com/v1/databases/${CONFIG.NOTION_DBS.TRIP_INSIGHTS}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.NOTION_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: { property: 'Trip', title: { equals: 'Boracay April 2026' } },
        }),
      }
    );
    const existingData = await existing.json();

    // Archive old pages
    for (const row of (existingData.results || [])) {
      await fetch(`https://api.notion.com/v1/pages/${row.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${CONFIG.NOTION_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived: true }),
      });
    }

    // Create new
    await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: CONFIG.NOTION_DBS.TRIP_INSIGHTS },
        properties: {
          'Trip': { title: [{ text: { content: 'Boracay April 2026' } }] },
          'Summary': { rich_text: [{ text: { content: insight.summary.slice(0, 1900) } }] },
          'News Items JSON': {
            rich_text: [{
              text: { content: JSON.stringify(insight.newsItems).slice(0, 1900) }
            }]
          },
          'Last Fetched': { date: { start: insight.fetchedAt } },
          'Expires At': { date: { start: insight.expiresAt } },
        },
      }),
    });
  } catch (e) {
    console.error('[Insights] Cache save error:', e);
  }
};

// --- End of commented-out Notion code ---
*/

// Stub: returns empty defaults until Supabase-backed implementation is added
export const getTripInsight = async (_forceRefresh = false): Promise<TripInsight> => {
  return {
    summary: '',
    newsItems: [],
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  };
};
