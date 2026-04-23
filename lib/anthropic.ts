// Anthropic client (fetch-based). Used by AI Trip Planner in Phase 4.

import type { AIRecommendation } from './types';
import { CONFIG } from './config';

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
  const key = CONFIG.ANTHROPIC_KEY;
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

export interface ItineraryActivity {
  name: string;
  category: 'Food' | 'Beach' | 'Activity' | 'Culture' | 'Nightlife' | 'Wellness' | 'Shopping' | 'Transport';
  timeSlot: 'morning' | 'afternoon' | 'evening';
  duration: string;       // e.g. "1-2 hrs"
  cost: string;           // e.g. "₱500-800" or "Free"
  tip: string;            // one-liner practical tip
  description: string;    // one sentence about why this is worth it
}

export interface ItineraryDay {
  day: number;
  date: string;
  theme: string;
  activities: ItineraryActivity[];
}

// Legacy shape for backward compat with existing rendered itineraries
export interface ItineraryDayLegacy {
  day: number;
  date: string;
  theme: string;
  morning: string;
  afternoon: string;
  evening: string;
  dining: string;
  tips: string;
}

export type PlannerScope = 'whole' | 'today' | 'surprise';
export type PlannerPace = 'relaxed' | 'moderate' | 'packed';

const ITINERARY_SYSTEM = `You are a local travel expert for Boracay, Philippines. The user is staying at Canyon Hotels & Resorts (Station B, near White Beach, Station 1). Group of 3-4 adults.

Return ONLY a JSON array of day objects (no prose, no code fences):
[
  {
    "day": 1,
    "date": "Apr 21",
    "theme": "Arrival & White Beach",
    "activities": [
      {
        "name": "Place or Activity Name",
        "category": "Food|Beach|Activity|Culture|Nightlife|Wellness|Shopping|Transport",
        "timeSlot": "morning|afternoon|evening",
        "duration": "1-2 hrs",
        "cost": "₱500-800",
        "tip": "Go early to avoid crowds",
        "description": "Why this is worth it in one sentence"
      }
    ]
  }
]

Rules:
- Use the EXACT dates provided in the user message. The "date" field must match the actual calendar date for each day.
- Relaxed pace: 2-3 activities per day. Moderate: 3-4. Packed: 5-6.
- Order activities by time within each day (morning→afternoon→evening).
- Include at least one food recommendation per day.
- Mix popular tourist spots with hidden gems locals know.
- Each activity must have a real place name (not generic like "the beach").
- Cost should be specific PHP ranges, or "Free".`;

export async function generateItinerary(args: {
  scope: PlannerScope;
  pace: PlannerPace;
  interests: string[];
  tripDays?: number;
  startDate?: string;
}): Promise<ItineraryDay[]> {
  const key = CONFIG.ANTHROPIC_KEY;
  if (!key) throw new Error('Anthropic API key missing. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env.');

  const paceDescriptions: Record<PlannerPace, string> = {
    relaxed: 'Relaxed pace: 2-3 activities/day, plenty of free time and rest.',
    moderate: 'Moderate pace: 3-4 activities/day, balanced with downtime.',
    packed: 'Packed schedule: 5-6 activities/day, maximize every hour.',
  };

  const numDays = args.scope === 'today' ? 1 : (args.tripDays ?? 7);
  const todayStr = formatShortDate(new Date());
  const startDateStr = args.startDate ? formatShortDate(new Date(args.startDate + 'T00:00:00+08:00')) : todayStr;
  const dateInfo = args.scope === 'today'
    ? `Plan for TODAY only (1 day). Today is ${todayStr}. Current time of day: ${getTimeOfDay()}.`
    : `${numDays} days, starting ${startDateStr}. Use correct calendar dates for each day.`;

  const surpriseNote = args.scope === 'surprise'
    ? '\nSurprise the user — pick a random mix of popular and offbeat activities. Vary the theme each day.'
    : '';

  const userMsg = [
    `Pace: ${paceDescriptions[args.pace]}`,
    `Interests: ${args.interests.join(', ')}.`,
    dateInfo,
    surpriseNote,
    'Return ONLY a JSON array, no prose, no code fences.',
  ].filter(Boolean).join('\n');

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
      max_tokens: args.scope === 'today' ? 1024 : 4096,
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

function formatShortDate(d: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 6) return 'early morning (before 6 AM) — suggest breakfast and morning activities only';
  if (h < 12) return 'morning — suggest remaining morning + afternoon + evening activities';
  if (h < 17) return 'afternoon — skip morning, suggest afternoon + evening activities';
  return 'evening — suggest evening and nightlife activities only';
}

// ── Receipt scanning ───────────────────────────────────────────────

export interface ReceiptLineItem {
  name: string;
  qty: number;
  amount: number;
}

export interface ScannedReceipt {
  placeName: string;
  description: string;
  amount: number;
  currency: string;
  category: 'Food' | 'Transport' | 'Activity' | 'Accommodation' | 'Shopping' | 'Other';
  date: string; // YYYY-MM-DD
  items: ReceiptLineItem[]; // individual line items with amounts
}

export async function scanReceipt(base64Image: string, mimeType: string = 'image/jpeg'): Promise<ScannedReceipt> {
  const key = CONFIG.ANTHROPIC_KEY;
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
            text: `Extract receipt information from this image. Read every line item with its quantity and price. Return ONLY a JSON object (no prose, no code fences) with these fields:
{
  "placeName": "store/restaurant name",
  "description": "brief summary, e.g. 'Lunch for 3'",
  "amount": 123.45,
  "currency": "PHP",
  "category": "Food|Transport|Activity|Accommodation|Shopping|Other",
  "date": "YYYY-MM-DD",
  "items": [
    { "name": "Chicken Adobo", "qty": 2, "amount": 350 },
    { "name": "Rice", "qty": 3, "amount": 75 }
  ]
}
Rules:
- "amount" is the receipt TOTAL (sum of all items + tax/service charge if shown).
- Each item in "items" has name, qty (default 1), and amount (unit price × qty).
- Include tax/service charge as a separate item if shown.
- If you cannot read a field, use reasonable defaults.
- Default currency to PHP. Default date to today: ${new Date().toISOString().slice(0, 10)}.`,
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

// ── Trip document scanner ─────────────────────────────────────────

export interface ScannedTripDetails {
  destination: string;
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  accommodation?: string;  // hotel name
  address?: string;
  checkIn?: string;        // e.g. "3:00 PM"
  checkOut?: string;
  roomType?: string;
  bookingRef?: string;
  cost?: number;
  costCurrency?: string;
  flights?: {
    direction: 'Outbound' | 'Return';
    flightNumber: string;
    airline?: string;
    from: string;
    to: string;
    departTime: string;    // ISO datetime
    arriveTime: string;
    bookingRef?: string;
  }[];
  members?: string[];      // names found in bookings
}

export async function scanTripDocuments(
  images: { base64: string; mimeType: string }[],
): Promise<ScannedTripDetails> {
  const key = CONFIG.ANTHROPIC_KEY;
  if (!key) throw new Error('Anthropic API key missing.');

  const imageBlocks = images.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mimeType,
      data: img.base64,
    },
  }));

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
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text',
            text: `Extract trip details from these screenshots. They may be flight bookings, hotel confirmations, itineraries, or general trip screenshots.

Return ONLY a JSON object (no prose, no code fences):
{
  "destination": "City, Country",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "accommodation": "Hotel name",
  "address": "Hotel address",
  "checkIn": "3:00 PM",
  "checkOut": "12:00 PM",
  "roomType": "Deluxe King",
  "bookingRef": "ABC123",
  "cost": 15000,
  "costCurrency": "PHP",
  "flights": [
    {
      "direction": "Outbound",
      "flightNumber": "5J 123",
      "airline": "Cebu Pacific",
      "from": "Manila (MNL)",
      "to": "Kalibo (KLO)",
      "departTime": "2026-04-20T06:00:00+08:00",
      "arriveTime": "2026-04-20T07:05:00+08:00",
      "bookingRef": "XYZ789"
    }
  ],
  "members": ["Peter", "Jane"]
}

Rules:
- Extract as much as you can from the images. Leave fields empty/null if not found.
- Dates must be YYYY-MM-DD format. Times must include timezone offset (+08:00 for Philippines).
- If multiple flights found, include all of them with correct direction (Outbound or Return).
- If you see passenger names, list them in "members".
- Cost should be numeric (no currency symbol). Currency as ISO code.
- Default currency to PHP if not specified.`,
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

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) throw new Error('Could not parse trip details.');

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as ScannedTripDetails;
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
