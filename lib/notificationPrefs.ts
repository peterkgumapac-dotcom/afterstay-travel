import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------- TYPES ----------

export interface NotificationCategoryPrefs {
  departureReminders: boolean;
  budgetAlerts: boolean;
  packingReminders: boolean;
  groupActivity: boolean;
  expenseAlerts: boolean;
  tripLifecycle: boolean;
  checkInOut: boolean;
}

export interface NotificationPhasePrefs {
  preTripAlerts: boolean;
  activeTripAlerts: boolean;
  postTripAlerts: boolean;
}

export interface QuietHoursPrefs {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export interface NotificationPrefs extends NotificationCategoryPrefs, NotificationPhasePrefs {
  quietHours: QuietHoursPrefs;
  mutedTrips: string[];
}

// ---------- DEFAULTS ----------

export const DEFAULT_CATEGORY_PREFS: NotificationCategoryPrefs = {
  departureReminders: true,
  budgetAlerts: true,
  packingReminders: true,
  groupActivity: true,
  expenseAlerts: true,
  tripLifecycle: true,
  checkInOut: true,
};

export const DEFAULT_PHASE_PREFS: NotificationPhasePrefs = {
  preTripAlerts: true,
  activeTripAlerts: true,
  postTripAlerts: true,
};

export const DEFAULT_QUIET_HOURS: QuietHoursPrefs = {
  enabled: false,
  startHour: 22,
  endHour: 7,
};

export const DEFAULT_PREFS: NotificationPrefs = {
  ...DEFAULT_CATEGORY_PREFS,
  ...DEFAULT_PHASE_PREFS,
  quietHours: DEFAULT_QUIET_HOURS,
  mutedTrips: [],
};

// ---------- TYPE → CATEGORY MAPPING ----------

const NOTIF_TYPE_TO_CATEGORY: Record<string, keyof NotificationCategoryPrefs> = {
  // DB notifications
  expense_added: 'expenseAlerts',
  member_joined: 'groupActivity',
  budget_threshold: 'budgetAlerts',
  vote_needed: 'groupActivity',
  moments_added: 'groupActivity',
  trip_starting: 'tripLifecycle',
  departure_prep: 'departureReminders',
  last_day: 'tripLifecycle',
  check_in_reminder: 'checkInOut',
  check_out_reminder: 'checkInOut',
  flight_boarding: 'departureReminders',
  trip_recap_ready: 'tripLifecycle',
  // Local alerts
  'budget-over': 'budgetAlerts',
  'budget-spike': 'budgetAlerts',
  'places-visit': 'groupActivity',
  'group-votes': 'groupActivity',
  'last-day': 'tripLifecycle',
  'ending-soon': 'tripLifecycle',
};

// ---------- PHASE DETECTION ----------

type TripPhase = 'pre' | 'active' | 'post' | 'unknown';

function getTripPhase(startDate?: string, endDate?: string): TripPhase {
  if (!startDate || !endDate) return 'unknown';
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  // Set end to end of day
  end.setHours(23, 59, 59, 999);
  if (now < start) return 'pre';
  if (now > end) return 'post';
  return 'active';
}

// ---------- CORE CHECK ----------

/**
 * Determines whether a notification should be created/displayed.
 * Returns false if the user's preferences suppress it.
 */
export function shouldNotify(
  type: string,
  prefs: Partial<NotificationPrefs>,
  opts?: { tripId?: string; tripStartDate?: string; tripEndDate?: string },
): boolean {
  const resolved = { ...DEFAULT_PREFS, ...prefs };

  // Check muted trips
  if (opts?.tripId && resolved.mutedTrips.includes(opts.tripId)) {
    return false;
  }

  // Check category toggle
  const category = NOTIF_TYPE_TO_CATEGORY[type];
  if (category && !resolved[category]) {
    return false;
  }

  // Check phase toggle
  if (opts?.tripStartDate && opts?.tripEndDate) {
    const phase = getTripPhase(opts.tripStartDate, opts.tripEndDate);
    if (phase === 'pre' && !resolved.preTripAlerts) return false;
    if (phase === 'active' && !resolved.activeTripAlerts) return false;
    if (phase === 'post' && !resolved.postTripAlerts) return false;
  }

  return true;
}

/**
 * Determines whether a push notification should be sent right now.
 * Returns false during quiet hours (in-app notification is still kept).
 */
export function shouldSendPush(prefs: Partial<NotificationPrefs>): boolean {
  const resolved = { ...DEFAULT_PREFS, ...prefs };
  const { quietHours } = resolved;
  if (!quietHours.enabled) return true;

  // PHT = UTC+8
  const now = new Date();
  const phtHour = (now.getUTCHours() + 8) % 24;

  const { startHour, endHour } = quietHours;
  // Handle overnight range (e.g. 22 to 7)
  if (startHour > endHour) {
    return phtHour >= endHour && phtHour < startHour;
  }
  // Same-day range (e.g. 13 to 15)
  return phtHour < startHour || phtHour >= endHour;
}

/**
 * Returns the category key for a notification type, if mapped.
 */
export function getCategoryForType(type: string): keyof NotificationCategoryPrefs | undefined {
  return NOTIF_TYPE_TO_CATEGORY[type];
}

// ---------- LOCAL STORAGE ----------

const STORAGE_KEY = 'settings_notifications';

let cachedPrefs: Partial<NotificationPrefs> | undefined;

/** Read notification prefs from AsyncStorage (client-side). Cached after first read. */
export async function getLocalNotificationPrefs(): Promise<Partial<NotificationPrefs>> {
  if (cachedPrefs) return cachedPrefs;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      cachedPrefs = JSON.parse(raw);
      return cachedPrefs!;
    }
  } catch { /* fallback to defaults */ }
  return {};
}

/** Invalidate the cached prefs (call after settings change). */
export function clearPrefsCache(): void {
  cachedPrefs = undefined;
}
