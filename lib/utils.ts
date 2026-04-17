// Date, countdown, formatting, and misc helpers.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export function daysUntil(iso: string, now: Date = new Date()): number {
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

export function formatDateRange(startIso: string, endIso: string): string {
  const s = toPht(startIso);
  const e = toPht(endIso);
  return `${MONTHS_SHORT[s.getUTCMonth()]} ${s.getUTCDate()} – ${MONTHS_SHORT[e.getUTCMonth()]} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
}

export function formatTime(iso: string): string {
  // Manual PHT (UTC+8) formatting — device-timezone-safe
  const pht = toPht(iso);
  let h = pht.getUTCHours();
  const m = pht.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatDay(iso: string): string {
  const d = toPht(iso);
  return DAYS_SHORT[d.getUTCDay()];
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

export function flightDuration(departIso: string, arriveIso: string): string {
  const ms = safeParse(arriveIso).getTime() - safeParse(departIso).getTime();
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function calcLeaveByTime(
  departIso: string,
  minutesToAirport: number = 60
): { leaveBy: string; checkoutBuffer: string } {
  const depart = safeParse(departIso);
  // Airport arrival buffer: 90 minutes before domestic
  const atAirport = new Date(depart.getTime() - 90 * 60000);
  const leaveBy = new Date(atAirport.getTime() - minutesToAirport * 60000);
  return {
    leaveBy: formatTimePHT(leaveBy.toISOString()),
    checkoutBuffer: formatTimePHT(atAirport.toISOString()),
  };
}

export function hoursUntil(iso: string, now: Date = new Date()): number {
  const ms = safeParse(iso).getTime() - now.getTime();
  return ms / (1000 * 60 * 60);
}

export function formatTimePHT(iso: string): string {
  return formatTime(iso);
}

export function formatDatePHT(iso: string): string {
  const d = toPht(iso);
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function mask(value: string, visible: number = 2): string {
  if (!value) return '';
  if (value.length <= visible) return '•'.repeat(value.length);
  return '•'.repeat(value.length - visible) + value.slice(-visible);
}
