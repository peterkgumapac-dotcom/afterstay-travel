// Date, countdown, formatting, and misc helpers.

export const MS_PER_DAY = 86_400_000;
export const MS_PER_HOUR = 3_600_000;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Android-safe date parser. Date-only strings like "2026-04-20" get parsed as
 * UTC midnight which shifts the date — append PHT timezone to avoid that.
 */
export function safeParse(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(iso + 'T00:00:00+08:00');
  }
  return new Date(iso);
}

function daysUntil(iso: string, now: Date = new Date()): number {
  const target = safeParse(iso);
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function tripStatusLabel(
  startIso: string,
  endIso: string,
  nights: number,
  now: Date = new Date()
): string {
  const start = safeParse(startIso);
  const end = safeParse(endIso);
  if (now < start) {
    const days = daysUntil(startIso, now);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days} days away`;
  }
  if (now > end) return 'Completed';
  const msIn = now.getTime() - start.getTime();
  const dayNum = Math.floor(msIn / (1000 * 60 * 60 * 24)) + 1;
  return `Day ${Math.min(dayNum, nights)} of ${nights}`;
}

/** Convert any ISO string to a Date offset to PHT wall-clock time.
 *  Use getUTC* methods on the returned Date to read PHT components. */
function toPht(iso: string): Date {
  const d = safeParse(iso);
  // d.getTime() is always UTC ms — add PHT offset and use getUTC* to read
  return new Date(d.getTime() + 8 * 60 * 60 * 1000);
}

function formatTime(iso: string): string {
  // Manual PHT (UTC+8) formatting — device-timezone-safe
  const pht = toPht(iso);
  let h = pht.getUTCHours();
  const m = pht.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatCurrency(amount: number, currency: string = 'PHP'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatTimePHT(iso: string): string {
  return formatTime(iso);
}

export function formatDatePHT(iso: string): string {
  const d = toPht(iso);
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function fmtKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function travelTime(km: number, mode: 'walk' | 'car'): string {
  if (mode === 'walk') {
    const min = Math.round(km * 12); // 5 km/h = 12 min/km
    if (min < 60) return `${min} min walk`;
    const h = Math.floor(min / 60);
    return `${h}h ${min % 60}m walk`;
  }
  // Car: tricycle hailing + slow resort roads
  const min = Math.max(3, Math.round(3 + km * 2.4));
  if (min < 60) return `${min} min drive`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m drive`;
}
