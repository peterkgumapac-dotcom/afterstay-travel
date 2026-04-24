import { formatDatePHT } from '@/lib/utils';
import type { Moment } from '@/lib/types';

export interface DayRecap {
  day: string;           // ISO date
  dayLabel: string;      // "Apr 21"
  dayOfWeek: string;     // "Monday"
  dayNumber: number;     // Day 3 of trip
  destination: string;
  photos: string[];      // top 5 photo URLs
  heroPhoto: string;     // best photo for hero slot
  totalMoments: number;
  places: string[];      // unique location names
  placeCount: number;
  caption?: string;      // best caption from the day
}

export interface TripRecap {
  destination: string;
  totalDays: number;
  totalMoments: number;
  totalPlaces: number;
  days: DayRecap[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Generate day-by-day recaps from moments.
 * Picks best photos, extracts stats, groups by date.
 */
export function generateTripRecap(
  moments: Moment[],
  destination: string,
  tripStartDate: string,
): TripRecap {
  // Group by date
  const byDay = new Map<string, Moment[]>();
  for (const m of moments) {
    const list = byDay.get(m.date) ?? [];
    list.push(m);
    byDay.set(m.date, list);
  }

  // Sort days chronologically
  const sortedDays = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  const tripStart = new Date(tripStartDate + 'T00:00:00+08:00');

  const days: DayRecap[] = sortedDays.map(([day, dayMoments]) => {
    const photosWithUrl = dayMoments.filter((m) => m.photo);
    const photos = photosWithUrl.map((m) => m.photo!);

    // Pick hero: prefer moments with both caption and location
    const scored = photosWithUrl.map((m) => {
      let score = 0;
      if (m.caption && m.caption !== 'Untitled') score += 2;
      if (m.location) score += 1;
      return { m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const heroPhoto = scored[0]?.m.photo ?? photos[0] ?? '';

    // Unique places
    const places = [...new Set(
      dayMoments
        .map((m) => m.location)
        .filter((l): l is string => !!l && l.length > 0),
    )];

    // Best caption
    const bestCaption = dayMoments.find(
      (m) => m.caption && m.caption !== 'Untitled' && m.caption.length > 3,
    )?.caption;

    // Day number relative to trip start
    const dayDate = new Date(day + 'T00:00:00+08:00');
    const dayNumber = Math.max(1, Math.floor((dayDate.getTime() - tripStart.getTime()) / 86400000) + 1);
    const dayOfWeek = DAY_NAMES[dayDate.getDay()];

    return {
      day,
      dayLabel: formatDatePHT(day),
      dayOfWeek,
      dayNumber,
      destination,
      photos: photos.slice(0, 5),
      heroPhoto,
      totalMoments: dayMoments.length,
      places,
      placeCount: places.length,
      caption: bestCaption,
    };
  });

  const allPlaces = new Set(moments.map((m) => m.location).filter(Boolean));

  return {
    destination,
    totalDays: days.length,
    totalMoments: moments.length,
    totalPlaces: allPlaces.size,
    days,
  };
}
