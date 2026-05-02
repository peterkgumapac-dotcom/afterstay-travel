import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { createElement } from 'react';

import { getActiveTrip, getFlights, getExpenseSummary, getDailyExpenseSummary } from '@/lib/supabase';
import { tripStatusLabel, formatCurrency, formatTimePHT, formatDatePHT } from '@/lib/utils';
import { CATEGORY_COLOR } from './widget-theme';
import { WK_TRIP, WK_FLIGHT, WK_BUDGET } from './widget-data';
import { TripCountdownWidget } from './TripCountdownWidget';
import { NextFlightWidget } from './NextFlightWidget';
import { DailyBudgetWidget } from './DailyBudgetWidget';
import type { WidgetTripData, WidgetFlightData, WidgetBudgetData, WidgetBudgetBar } from './widget-data';

/**
 * Request an update for one or more Android home screen widgets.
 * No-op on iOS. Silently catches errors (widget may not be placed).
 */
export async function refreshWidgets(...widgetNames: string[]): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const name of widgetNames) {
    try {
      await requestWidgetUpdate({
        widgetName: name,
        renderWidget: () => {
          switch (name) {
            case 'NextFlight':
              return createElement(NextFlightWidget, { data: null });
            case 'DailyBudget':
              return createElement(DailyBudgetWidget, { data: null });
            default:
              return createElement(TripCountdownWidget, { data: null });
          }
        },
      });
    } catch {
      // Widget may not be placed on home screen — ignore
    }
  }
}

export const ALL_WIDGETS = ['TripCountdown', 'NextFlight', 'DailyBudget'] as const;

export function refreshAllWidgets(): Promise<void> {
  return refreshWidgets(...ALL_WIDGETS);
}

/**
 * Write widget data snapshots to AsyncStorage under fixed (non-user-scoped) keys.
 * Called from the app context where auth + Supabase are available.
 * The headless widget context reads these snapshots.
 */
export async function writeWidgetSnapshots(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // --- Trip snapshot ---
    const trip = await getActiveTrip();
    if (trip) {
      const tripData: WidgetTripData = {
        destination: trip.destination ?? 'My Trip',
        statusLabel: tripStatusLabel(trip.startDate, trip.endDate, trip.nights),
        isActive: new Date() >= new Date(trip.startDate + 'T00:00:00+08:00') && new Date() <= new Date(trip.endDate + 'T23:59:59+08:00'),
      };
      await AsyncStorage.setItem(WK_TRIP, JSON.stringify(tripData));

      // --- Flight snapshot ---
      try {
        const flights = await getFlights(trip.id);
        if (flights.length > 0) {
          const now = Date.now();
          const upcoming = flights
            .filter((f) => new Date(f.departTime).getTime() > now)
            .sort((a, b) => new Date(a.departTime).getTime() - new Date(b.departTime).getTime());
          const flight = upcoming[0] ?? flights[0];
          const flightData: WidgetFlightData = {
            airline: flight.airline ?? '',
            flightNumber: flight.flightNumber,
            from: flight.from,
            to: flight.to,
            departTime: formatTimePHT(flight.departTime),
            departDate: formatDatePHT(flight.departTime),
            direction: flight.direction,
          };
          await AsyncStorage.setItem(WK_FLIGHT, JSON.stringify(flightData));
        } else {
          await AsyncStorage.removeItem(WK_FLIGHT);
        }
      } catch {
        // Flight fetch failed — leave existing snapshot
      }

      // --- Budget snapshot (trip mode) ---
      try {
        const summary = await getExpenseSummary(trip.id);
        const currency = trip.costCurrency ?? 'PHP';
        const maxAmount = Math.max(...Object.values(summary.byCategory), 1);
        const bars: WidgetBudgetBar[] = Object.entries(summary.byCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 4)
          .map(([cat, amount]) => ({
            category: cat,
            color: CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.Other,
            percent: Math.round((amount / maxAmount) * 100),
            amount: formatCurrency(amount, currency),
          }));
        const budgetData: WidgetBudgetData = {
          total: formatCurrency(summary.total, currency),
          count: summary.count,
          bars,
          label: trip.destination ?? 'Trip',
        };
        await AsyncStorage.setItem(WK_BUDGET, JSON.stringify(budgetData));
      } catch {
        // Budget fetch failed — leave existing snapshot
      }
    } else {
      // No active trip — clear trip/flight, write daily budget
      await AsyncStorage.removeItem(WK_TRIP);
      await AsyncStorage.removeItem(WK_FLIGHT);

      try {
        const today = new Date().toISOString().slice(0, 10);
        const summary = await getDailyExpenseSummary(today);
        const maxAmount = Math.max(...Object.values(summary.byCategory), 1);
        const bars: WidgetBudgetBar[] = Object.entries(summary.byCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 4)
          .map(([cat, amount]) => ({
            category: cat,
            color: CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.Other,
            percent: Math.round((amount / maxAmount) * 100),
            amount: formatCurrency(amount, 'PHP'),
          }));
        const budgetData: WidgetBudgetData = {
          total: formatCurrency(summary.total, 'PHP'),
          count: summary.count,
          bars,
          label: 'Today',
        };
        await AsyncStorage.setItem(WK_BUDGET, JSON.stringify(budgetData));
      } catch {
        // Daily budget fetch failed — leave existing snapshot
      }
    }
  } catch {
    // Best effort — don't crash the app
  }
}
