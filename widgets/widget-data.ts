// Widget data layer — reads pre-populated snapshots from AsyncStorage.
// Widgets run in a headless JS context where Supabase auth is unavailable.
// The app writes snapshots via writeWidgetSnapshots() when data changes.

import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------- Types ----------

export interface WidgetTripData {
  destination: string;
  statusLabel: string;
  isActive: boolean;
}

export interface WidgetFlightData {
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departTime: string;
  departDate: string;
  direction: string;
}

export interface WidgetBudgetBar {
  category: string;
  color: string;
  percent: number;
  amount: string;
}

export interface WidgetBudgetData {
  total: string;
  count: number;
  bars: WidgetBudgetBar[];
  label: string;
}

// ---------- Fixed keys (not user-scoped) ----------

export const WK_TRIP = 'afterstay:widget:trip';
export const WK_FLIGHT = 'afterstay:widget:flight';
export const WK_BUDGET = 'afterstay:widget:budget';

// ---------- Readers (called from headless widget context) ----------

export async function getWidgetTripData(): Promise<WidgetTripData | null> {
  try {
    const raw = await AsyncStorage.getItem(WK_TRIP);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getWidgetFlightData(): Promise<WidgetFlightData | null> {
  try {
    const raw = await AsyncStorage.getItem(WK_FLIGHT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getWidgetBudgetData(): Promise<WidgetBudgetData | null> {
  try {
    const raw = await AsyncStorage.getItem(WK_BUDGET);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
