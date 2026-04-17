// Notion REST client (fetch-based — safer for React Native than @notionhq/client).
// Property names below match the actual Notion schema of the AfterStay workspace.

/** Android-safe date parser: date-only strings get PHT suffix to avoid UTC shift. */
function parseDateSafe(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(iso + 'T00:00:00+08:00');
  }
  return new Date(iso);
}

import type {
  ChecklistItem,
  Expense,
  Flight,
  GroupMember,
  Moment,
  MomentTag,
  PackingItem,
  Place,
  PlaceCategory,
  PlaceSource,
  PlaceVote,
  Trip,
  TripFile,
  TripFileType,
  TripStatus,
} from './types';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const env = {
  key: process.env.EXPO_PUBLIC_NOTION_API_KEY ?? '',
  tripDb: process.env.EXPO_PUBLIC_NOTION_TRIP_DB ?? '',
  packingDb: process.env.EXPO_PUBLIC_NOTION_PACKING_DB ?? '',
  expensesDb: process.env.EXPO_PUBLIC_NOTION_EXPENSES_DB ?? '',
  flightsDb: process.env.EXPO_PUBLIC_NOTION_FLIGHTS_DB ?? '',
  placesDb: process.env.EXPO_PUBLIC_NOTION_PLACES_DB ?? '',
  groupDb: process.env.EXPO_PUBLIC_NOTION_GROUP_DB ?? '',
  checklistDb: process.env.EXPO_PUBLIC_NOTION_CHECKLIST_DB ?? '',
  momentsDb: process.env.EXPO_PUBLIC_NOTION_MOMENTS_DB ?? '',
  filesDb: process.env.EXPO_PUBLIC_NOTION_FILES_DB ?? '',
  tripPageId: process.env.EXPO_PUBLIC_TRIP_PAGE_ID ?? '',
};

// ---------- low-level fetch ----------

async function notionFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!env.key) {
    throw new Error('Notion API key missing. Check .env EXPO_PUBLIC_NOTION_API_KEY.');
  }
  const res = await fetch(`${NOTION_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.key}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Notion ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

async function queryDatabase(dbId: string, body: any = {}): Promise<any[]> {
  const results: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const payload: any = { ...body };
    if (cursor) payload.start_cursor = cursor;
    const data = await notionFetch<any>(`/databases/${dbId}/query`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    results.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

async function createPage(parentDbId: string, properties: any): Promise<any> {
  return notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify({ parent: { database_id: parentDbId }, properties }),
  });
}

async function updatePage(pageId: string, properties: any): Promise<any> {
  return notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
}

// ---------- property helpers ----------

const P = {
  title: (text: string) => ({ title: [{ text: { content: text } }] }),
  richText: (text: string) => ({ rich_text: [{ text: { content: text } }] }),
  select: (name: string) => ({ select: { name } }),
  number: (n: number) => ({ number: n }),
  checkbox: (b: boolean) => ({ checkbox: b }),
  date: (start: string, end?: string) => ({ date: { start, end: end ?? null } }),
  relation: (ids: string[]) => ({ relation: ids.map(id => ({ id })) }),
};

function readTitle(prop: any): string {
  return prop?.title?.map((t: any) => t.plain_text).join('') ?? '';
}
function readRichText(prop: any): string {
  return prop?.rich_text?.map((t: any) => t.plain_text).join('') ?? '';
}
function readSelect(prop: any): string {
  return prop?.select?.name ?? '';
}
function readNumber(prop: any): number | undefined {
  return typeof prop?.number === 'number' ? prop.number : undefined;
}
function readCheckbox(prop: any): boolean {
  return !!prop?.checkbox;
}
function readDate(prop: any): { start?: string; end?: string } {
  return { start: prop?.date?.start, end: prop?.date?.end };
}
function readUrl(prop: any): string | undefined {
  return prop?.url ?? undefined;
}
function readEmail(prop: any): string {
  return prop?.email ?? '';
}
function readPhone(prop: any): string {
  return prop?.phone_number ?? '';
}
function readMultiSelect(prop: any): string[] {
  return (prop?.multi_select ?? []).map((s: any) => s.name);
}

// ---------- TRIPS ----------

function mapTrip(page: any): Trip {
  const props = page.properties ?? {};
  const start = readDate(props['Start Date']).start ?? '';
  const end = readDate(props['End Date']).end ?? readDate(props['End Date']).start ?? start;
  const nights =
    start && end
      ? Math.max(
          1,
          Math.round((parseDateSafe(end).getTime() - parseDateSafe(start).getTime()) / 86400000)
        )
      : 0;
  return {
    id: page.id,
    name: readTitle(props['Trip Name']),
    destination: readRichText(props['Destination']),
    startDate: start,
    endDate: end,
    nights,
    accommodation: readRichText(props['Accommodation Name']),
    address: readRichText(props['Accommodation Address']),
    roomType: '',
    checkIn: readRichText(props['Check-in Time']),
    checkOut: readRichText(props['Check-out Time']),
    transport: readSelect(props['Transport Mode']),
    wifiSsid: readRichText(props['WiFi Network']),
    wifiPassword: readRichText(props['WiFi Password']),
    doorCode: readRichText(props['Door Code']),
    notes: readRichText(props['Notes']),
    status: (readSelect(props['Status']) || 'Planning') as TripStatus,
    hotelUrl: readUrl(props['Hotel URL']),
    airportArrivalBuffer: readRichText(props['Airport Arrival Buffer']),
    airportToHotelTime: readRichText(props['Airport to Hotel Time']),
    customQuickAccess: readRichText(props['Custom Quick Access']),
    transportNotes: readRichText(props['Transport Notes']),
    houseRules: readRichText(props['House Rules']),
    emergencyContacts: readRichText(props['Emergency Contacts']),
    hotelPhotos: readRichText(props['Hotel Photos']),
    budgetLimit: readNumber(props['Budget Limit']),
    budgetMode: (readSelect(props['Budget Mode']) || 'Unlimited') as Trip['budgetMode'],
  };
}

export async function getActiveTrip(): Promise<Trip | null> {
  const results = await queryDatabase(env.tripDb, {
    filter: {
      or: [
        { property: 'Status', select: { equals: 'Planning' } },
        { property: 'Status', select: { equals: 'Active' } },
      ],
    },
    page_size: 5,
  });
  if (!results.length) return null;
  return mapTrip(results[0]);
}

export async function updateTrip(pageId: string, properties: any) {
  return updatePage(pageId, properties);
}

// ---------- FLIGHTS ----------

function mapFlight(page: any): Flight {
  const props = page.properties ?? {};
  const depart = readDate(props['Departure Time']);
  const arrive = readDate(props['Arrival Time']);
  return {
    id: page.id,
    direction: (readSelect(props['Direction']) as Flight['direction']) || 'Outbound',
    flightNumber: readTitle(props['Flight Number']),
    airline: readRichText(props['Airline']),
    from: readRichText(props['Departure City']),
    to: readRichText(props['Arrival City']),
    departTime: depart.start ?? '',
    arriveTime: arrive.start ?? '',
    passenger: readRichText(props['Traveler']),
  };
}

export async function getFlights(tripPageId: string = env.tripPageId): Promise<Flight[]> {
  const results = await queryDatabase(env.flightsDb, {
    filter: { property: 'Trip', relation: { contains: tripPageId } },
  });
  return results.map(mapFlight);
}

export async function addFlight(input: Omit<Flight, 'id'> & { tripId?: string }) {
  const tripId = input.tripId ?? env.tripPageId;
  return createPage(env.flightsDb, {
    'Flight Number': P.title(input.flightNumber),
    Direction: P.select(input.direction),
    Airline: P.richText(input.airline),
    'Departure City': P.richText(input.from),
    'Arrival City': P.richText(input.to),
    'Departure Time': P.date(input.departTime),
    'Arrival Time': P.date(input.arriveTime),
    ...(input.passenger ? { Traveler: P.richText(input.passenger) } : {}),
    Trip: P.relation([tripId]),
  });
}

// ---------- GROUP ----------

function mapMember(page: any): GroupMember {
  const props = page.properties ?? {};
  return {
    id: page.id,
    name: readTitle(props['Name']),
    role: (readSelect(props['Role']) as GroupMember['role']) || 'Member',
    phone: readPhone(props['Phone']) || readRichText(props['Phone']),
    email: readEmail(props['Email']) || readRichText(props['Email']),
    profilePhoto: readUrl(props['Profile Photo']),
  };
}

export async function getGroupMembers(tripPageId: string = env.tripPageId) {
  const results = await queryDatabase(env.groupDb, {
    filter: { property: 'Trip', relation: { contains: tripPageId } },
  });
  return results.map(mapMember);
}

export async function addGroupMember(input: Omit<GroupMember, 'id'> & { tripId?: string }) {
  const tripId = input.tripId ?? env.tripPageId;
  return createPage(env.groupDb, {
    Name: P.title(input.name),
    Role: P.select(input.role),
    Trip: P.relation([tripId]),
  });
}

// ---------- PACKING ----------

function mapPacking(page: any): PackingItem {
  const props = page.properties ?? {};
  return {
    id: page.id,
    item: readTitle(props['Item']),
    category: (readSelect(props['Category']) as PackingItem['category']) || 'Other',
    packed: readCheckbox(props['Packed']),
  };
}

export async function getPackingList(tripPageId: string = env.tripPageId) {
  const results = await queryDatabase(env.packingDb, {
    filter: { property: 'Trip', relation: { contains: tripPageId } },
  });
  return results.map(mapPacking);
}

export async function addPackingItem(input: Omit<PackingItem, 'id' | 'packed'> & { tripId?: string }) {
  const tripId = input.tripId ?? env.tripPageId;
  return createPage(env.packingDb, {
    Item: P.title(input.item),
    Category: P.select(input.category),
    Packed: P.checkbox(false),
    Trip: P.relation([tripId]),
  });
}

export async function togglePacked(pageId: string, packed: boolean) {
  return updatePage(pageId, { Packed: P.checkbox(packed) });
}

// ---------- EXPENSES ----------

function mapExpense(page: any): Expense {
  const props = page.properties ?? {};
  const date = readDate(props['Date']);
  return {
    id: page.id,
    description: readTitle(props['Description']),
    amount: readNumber(props['Amount']) ?? 0,
    currency: readSelect(props['Currency']) || 'PHP',
    category: (readSelect(props['Category']) as Expense['category']) || 'Other',
    date: date.start ?? '',
    paidBy: readRichText(props['Paid By']),
    photo: readUrl(props['Photo']),
    placeName: readRichText(props['Place Name']),
    splitType: (readSelect(props['Split Type']) as Expense['splitType']) || undefined,
    notes: readRichText(props['Notes']),
  };
}

export async function getExpenses(tripPageId: string = env.tripPageId) {
  const results = await queryDatabase(env.expensesDb, {
    filter: { property: 'Trip', relation: { contains: tripPageId } },
    sorts: [{ property: 'Date', direction: 'descending' }],
  });
  return results.map(mapExpense);
}

export async function addExpense(input: Omit<Expense, 'id'> & { tripId?: string }) {
  const tripId = input.tripId ?? env.tripPageId;
  return createPage(env.expensesDb, {
    Description: P.title(input.description),
    Amount: P.number(input.amount),
    Currency: P.select(input.currency),
    Category: P.select(input.category),
    Date: P.date(input.date),
    ...(input.paidBy ? { 'Paid By': P.richText(input.paidBy) } : {}),
    ...(input.photo ? { Photo: { url: input.photo } } : {}),
    ...(input.placeName ? { 'Place Name': P.richText(input.placeName) } : {}),
    ...(input.splitType ? { 'Split Type': P.select(input.splitType) } : {}),
    ...(input.notes ? { Notes: P.richText(input.notes) } : {}),
    Trip: P.relation([tripId]),
  });
}

export async function deleteExpense(pageId: string) {
  return deletePage(pageId);
}

export async function updateExpense(pageId: string, input: Partial<Omit<Expense, 'id'>>) {
  const properties: any = {};
  if (input.description != null) properties['Description'] = P.title(input.description);
  if (input.amount != null) properties['Amount'] = P.number(input.amount);
  if (input.currency != null) properties['Currency'] = P.select(input.currency);
  if (input.category != null) properties['Category'] = P.select(input.category);
  if (input.date != null) properties['Date'] = P.date(input.date);
  if (input.paidBy != null) properties['Paid By'] = P.richText(input.paidBy);
  if (input.placeName != null) properties['Place Name'] = P.richText(input.placeName);
  if (input.splitType != null) properties['Split Type'] = P.select(input.splitType);
  if (input.notes != null) properties['Notes'] = P.richText(input.notes);
  if (input.photo != null) properties['Photo'] = { url: input.photo };
  return updatePage(pageId, properties);
}

export async function getExpenseSummary(tripPageId: string = env.tripPageId) {
  const expenses = await getExpenses(tripPageId);
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    total += e.amount;
  }
  return { total, byCategory, count: expenses.length };
}

// ---------- PLACES ----------

// Rating is a select in Notion (⭐ through ⭐⭐⭐⭐⭐). Convert to/from number.
const RATING_TO_STARS: Record<number, string> = {
  1: '⭐',
  2: '⭐⭐',
  3: '⭐⭐⭐',
  4: '⭐⭐⭐⭐',
  5: '⭐⭐⭐⭐⭐',
};
function starsToRating(stars: string): number | undefined {
  if (!stars) return undefined;
  const n = stars.replace(/[^⭐]/g, '').length;
  return n || undefined;
}

function mapPlace(page: any): Place {
  const props = page.properties ?? {};
  return {
    id: page.id,
    name: readTitle(props['Name']),
    category: (readSelect(props['Category']) as PlaceCategory) || 'Do',
    distance: readRichText(props['Distance']),
    notes: readRichText(props['Notes']),
    priceEstimate: readRichText(props['Price Estimate']),
    rating: starsToRating(readSelect(props['Rating'])),
    source: (readSelect(props['Source']) as PlaceSource) || 'Manual',
    vote: (readSelect(props['Vote']) as PlaceVote) || 'Pending',
    photoUrl: readUrl(props['Photo']),
    googlePlaceId: readRichText(props['Google Place ID']),
    googleMapsUri: readRichText(props['Google Maps URI']) || undefined,
    totalRatings: readNumber(props['Total Ratings']),
    latitude: readNumber(props['Latitude']),
    longitude: readNumber(props['Longitude']),
    saved: readCheckbox(props['Saved']),
  };
}

export async function getSavedPlaces(tripPageId: string = env.tripPageId) {
  const results = await queryDatabase(env.placesDb, {
    filter: { property: 'Trip', relation: { contains: tripPageId } },
  });
  return results.map(mapPlace);
}

export async function addPlace(input: Omit<Place, 'id'> & { tripId?: string }) {
  const tripId = input.tripId ?? env.tripPageId;
  const ratingStars = input.rating ? RATING_TO_STARS[Math.max(1, Math.min(5, Math.round(input.rating)))] : undefined;
  return createPage(env.placesDb, {
    Name: P.title(input.name),
    Category: P.select(input.category),
    ...(input.distance ? { Distance: P.richText(input.distance) } : {}),
    ...(input.notes ? { Notes: P.richText(input.notes) } : {}),
    ...(input.priceEstimate ? { 'Price Estimate': P.richText(input.priceEstimate) } : {}),
    ...(ratingStars ? { Rating: P.select(ratingStars) } : {}),
    Source: P.select(input.source),
    Vote: P.select(input.vote),
    ...(input.photoUrl ? { Photo: { url: input.photoUrl } } : {}),
    ...(input.googlePlaceId ? { 'Google Place ID': P.richText(input.googlePlaceId) } : {}),
    ...(input.saved != null ? { Saved: P.checkbox(input.saved) } : {}),
    ...(input.googleMapsUri ? { 'Google Maps URI': P.richText(input.googleMapsUri) } : {}),
    ...(input.totalRatings != null ? { 'Total Ratings': P.number(input.totalRatings) } : {}),
    ...(input.latitude != null ? { Latitude: P.number(input.latitude) } : {}),
    ...(input.longitude != null ? { Longitude: P.number(input.longitude) } : {}),
    Trip: P.relation([tripId]),
  });
}

export async function voteOnPlace(pageId: string, vote: PlaceVote) {
  return updatePage(pageId, { Vote: P.select(vote) });
}

export async function savePlace(pageId: string, saved: boolean) {
  return updatePage(pageId, { Saved: P.checkbox(saved) });
}

export async function deletePlacesForTrip(tripPageId: string = env.tripPageId) {
  const results = await queryDatabase(env.placesDb, {
    filter: { property: 'Trip', relation: { contains: tripPageId } },
  });
  await Promise.allSettled(
    results.map((page: any) =>
      notionFetch(`/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: true }),
      })
    ),
  );
}

// ---------- CHECKLIST ----------

function mapChecklist(page: any): ChecklistItem {
  const props = page.properties ?? {};
  return {
    id: page.id,
    task: readTitle(props['Task']),
    done: readCheckbox(props['Done']),
    doneBy: readRichText(props['Done By']),
  };
}

export async function getChecklist(tripPageId: string = env.tripPageId) {
  const results = await queryDatabase(env.checklistDb, {
    filter: { property: 'Trip', relation: { contains: tripPageId } },
    sorts: [{ property: 'Order', direction: 'ascending' }],
  });
  return results.map(mapChecklist);
}

export async function addChecklistItem(input: Omit<ChecklistItem, 'id' | 'done'> & { tripId?: string }) {
  const tripId = input.tripId ?? env.tripPageId;
  return createPage(env.checklistDb, {
    Task: P.title(input.task),
    Done: P.checkbox(false),
    ...(input.doneBy ? { 'Done By': P.richText(input.doneBy) } : {}),
    Trip: P.relation([tripId]),
  });
}

export async function toggleChecklistItem(pageId: string, done: boolean, doneBy?: string) {
  const properties: any = { Done: P.checkbox(done) };
  if (doneBy) properties['Done By'] = P.richText(doneBy);
  return updatePage(pageId, properties);
}

// ---------- MOMENTS ----------

function mapMoment(page: any): Moment {
  const props = page.properties ?? {};
  const date = readDate(props['Date']);
  return {
    id: page.id,
    caption: readTitle(props['Caption']),
    photo: readUrl(props['Photo']),
    location: readRichText(props['Location']),
    takenBy: readRichText(props['Taken By']),
    date: date.start ?? new Date().toISOString().slice(0, 10),
    tags: readMultiSelect(props['Tags']) as MomentTag[],
  };
}

export async function getMoments(tripPageId: string = env.tripPageId) {
  const results = await queryDatabase(env.momentsDb, {
    filter: { property: 'Trip', relation: { contains: tripPageId } },
    sorts: [{ property: 'Date', direction: 'descending' }],
  });
  return results.map(mapMoment);
}

export async function addMoment(input: Omit<Moment, 'id'> & { tripId?: string }) {
  const tripId = input.tripId ?? env.tripPageId;
  return createPage(env.momentsDb, {
    Caption: P.title(input.caption || 'Untitled'),
    ...(input.photo ? { Photo: { url: input.photo } } : {}),
    ...(input.location ? { Location: P.richText(input.location) } : {}),
    ...(input.takenBy ? { 'Taken By': P.richText(input.takenBy) } : {}),
    Date: P.date(input.date),
    ...(input.tags.length > 0 ? { Tags: { multi_select: input.tags.map(t => ({ name: t })) } } : {}),
    Trip: P.relation([tripId]),
  });
}

// ---------- TRIP FILES ----------

function mapTripFile(page: any): TripFile {
  const props = page.properties ?? {};
  return {
    id: page.id,
    fileName: readTitle(props['File Name']),
    fileUrl: readUrl(props['File URL']),
    type: (readSelect(props['Type']) as TripFileType) || 'Other',
    notes: readRichText(props['Notes']),
    printRequired: readCheckbox(props['Print Required']),
  };
}

export async function getTripFiles(tripPageId: string = env.tripPageId) {
  const results = await queryDatabase(env.filesDb, {
    filter: { property: 'Trip', relation: { contains: tripPageId } },
  });
  return results.map(mapTripFile);
}

export async function addTripFile(input: Omit<TripFile, 'id'> & { tripId?: string }) {
  const tripId = input.tripId ?? env.tripPageId;
  return createPage(env.filesDb, {
    'File Name': P.title(input.fileName),
    ...(input.fileUrl ? { 'File URL': { url: input.fileUrl } } : {}),
    Type: P.select(input.type),
    ...(input.notes ? { Notes: P.richText(input.notes) } : {}),
    'Print Required': P.checkbox(input.printRequired),
    Trip: P.relation([tripId]),
  });
}

export async function deletePage(pageId: string) {
  return notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  });
}

export async function updateMemberPhoto(pageId: string, photoUrl: string) {
  return updatePage(pageId, { 'Profile Photo': { url: photoUrl } });
}

export async function updateMemberEmail(pageId: string, email: string) {
  return updatePage(pageId, { Email: { email } });
}

export async function updateTripProperty(pageId: string, key: string, value: string) {
  return updatePage(pageId, { [key]: P.richText(value) });
}

export async function updateTripBudgetMode(pageId: string, mode: 'Limited' | 'Unlimited') {
  return updatePage(pageId, { 'Budget Mode': P.select(mode) });
}

export async function updateTripBudgetLimit(pageId: string, limit: number) {
  return updatePage(pageId, { 'Budget Limit': P.number(limit) });
}
