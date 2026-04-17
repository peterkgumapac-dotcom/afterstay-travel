// Anthropic client (fetch-based). Used by AI Trip Planner in Phase 4.

import type { AIRecommendation } from './types';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are a local travel expert for Boracay, Philippines. The user is staying at Canyon Hotels & Resorts (Station B, near White Beach, Station 1) for 7 nights (April 20-27, 2026). Generate a Top 5 list for each selected interest category.

For each recommendation include:
- Name
- Category
- Distance from Canyon Hotels (approximate)
- Price estimate in PHP
- One-line reason why
- Rating (1-5 stars)

Return as JSON array. Format:
[
  {
    "name": "Restaurant Name",
    "category": "Eat",
    "distance": "1.2 km",
    "price_estimate": "₱500-800/person",
    "reason": "Best seafood on the island with sunset views",
    "rating": 5
  }
]

Consider: it's late April (tail end of dry season, still hot). Group of 3 adults. Mix popular tourist spots with hidden gems locals know.`;

export async function generateRecommendations(args: {
  firstTime: 'First visit' | 'Been before' | 'Local-ish';
  interests: string[];
}): Promise<AIRecommendation[]> {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!key) throw new Error('Anthropic API key missing. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env.');

  const userMsg = `Visitor profile: ${args.firstTime}.\nInterests (Top 5 per category please): ${args.interests.join(', ')}.\nReturn ONLY a single JSON array, no prose, no code fences.`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes('credit balance is too low')) {
      throw new Error('Anthropic API credits exhausted. Please add credits at console.anthropic.com → Plans & Billing.');
    }
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }
  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';
  const json = extractJson(text);
  if (!Array.isArray(json)) throw new Error('AI did not return a JSON array.');
  return json as AIRecommendation[];
}

// ── Itinerary generation ──────────────────────────────────────────

export interface ItineraryDay {
  day: number;
  date: string;
  theme: string;
  morning: string;
  afternoon: string;
  evening: string;
  dining: string;
  tips: string;
}

export type ItineraryMode = 'Full Pack' | 'Lite in 7 Days' | 'Surprise Me';

const ITINERARY_SYSTEM = `You are a local travel expert for Boracay, Philippines. The user is staying at Canyon Hotels & Resorts (Station B, near White Beach, Station 1) for 7 nights (April 20-27, 2026). Group of 3 adults. Late April, tail end of dry season, still hot.

Generate a day-by-day itinerary. Return ONLY a JSON array of objects with these fields:
[
  {
    "day": 1,
    "date": "Apr 20",
    "theme": "Arrival & White Beach",
    "morning": "Activity description",
    "afternoon": "Activity description",
    "evening": "Activity description",
    "dining": "Restaurant suggestion with price range",
    "tips": "Practical tip for this day"
  }
]`;

export async function generateItinerary(args: {
  mode: ItineraryMode;
  interests: string[];
}): Promise<ItineraryDay[]> {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!key) throw new Error('Anthropic API key missing. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env.');

  const modeDescriptions: Record<ItineraryMode, string> = {
    'Full Pack': 'Packed schedule, morning to night activities every day. Maximize every hour.',
    'Lite in 7 Days': 'Relaxed pace, 1-2 activities per day with plenty of free time and rest.',
    'Surprise Me': 'Mix of popular spots and hidden gems. Spontaneous feel, varied pacing.',
  };

  const userMsg = `Mode: ${args.mode} — ${modeDescriptions[args.mode]}\nInterests: ${args.interests.join(', ')}.\n7 days, April 20-26. Return ONLY a JSON array, no prose, no code fences.`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: ITINERARY_SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (body.includes('credit balance is too low')) {
      throw new Error('Anthropic API credits exhausted. Please add credits at console.anthropic.com.');
    }
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';
  const json = extractJson(text);
  if (!Array.isArray(json)) throw new Error('AI did not return a JSON array.');
  return json as ItineraryDay[];
}

// ── Receipt scanning ───────────────────────────────────────────────

export interface ScannedReceipt {
  placeName: string;
  description: string;
  amount: number;
  currency: string;
  category: 'Food' | 'Transport' | 'Activity' | 'Accommodation' | 'Shopping' | 'Other';
  date: string; // YYYY-MM-DD
  items: string[]; // individual line items
}

export async function scanReceipt(base64Image: string, mimeType: string = 'image/jpeg'): Promise<ScannedReceipt> {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!key) throw new Error('Anthropic API key missing.');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `Extract receipt information from this image. Return ONLY a JSON object (no prose, no code fences) with these fields:
{
  "placeName": "store/restaurant name",
  "description": "brief description of purchase",
  "amount": 123.45,
  "currency": "PHP",
  "category": "Food|Transport|Activity|Accommodation|Shopping|Other",
  "date": "YYYY-MM-DD",
  "items": ["item 1", "item 2"]
}
If you cannot read a field, use reasonable defaults. Default currency to PHP. Default date to today: ${new Date().toISOString().slice(0, 10)}.`,
          },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (body.includes('credit balance is too low')) {
      throw new Error('Anthropic API credits exhausted. Add credits at console.anthropic.com.');
    }
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';

  // Strip code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) throw new Error('Could not parse receipt data.');

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as ScannedReceipt;
}

// ── Helpers ────────────────────────────────────────────────────────

function extractJson(text: string): unknown {
  // Strip common code-fence wrappers
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const firstBracket = candidate.indexOf('[');
  const lastBracket = candidate.lastIndexOf(']');
  if (firstBracket === -1 || lastBracket === -1) {
    throw new Error('No JSON array found in AI response.');
  }
  return JSON.parse(candidate.slice(firstBracket, lastBracket + 1));
}
