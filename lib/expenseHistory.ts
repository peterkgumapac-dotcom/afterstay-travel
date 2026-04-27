import { supabase, getAllUserTrips, getStandaloneExpenses } from './supabase'
import { getQuickTrips } from './quickTrips'
import type { UnifiedExpenseHistoryItem } from './types'

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Merges trip expenses, standalone expenses, and quick-trip expenses
 * into a single chronological list for the budget history view.
 */
export async function getUnifiedExpenseHistory(
  limit = 30,
): Promise<UnifiedExpenseHistoryItem[]> {
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) return []

  // Parallel fetch all three sources
  const [allTrips, standaloneExpenses, quickTrips] = await Promise.all([
    getAllUserTrips(userId),
    getStandaloneExpenses(limit),
    getQuickTrips(),
  ])

  // Trip expenses
  const tripIds = allTrips.map((t) => t.id)
  const tripNameMap = new Map(allTrips.map((t) => [t.id, t.destination ?? t.name]))

  const tripExpensesPromise =
    tripIds.length > 0
      ? supabase
          .from('expenses')
          .select('*')
          .in('trip_id', tripIds)
          .order('expense_date', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Record<string, unknown>[] })

  // Quick trip expenses
  const qtIds = quickTrips.map((qt) => qt.id)
  const qtNameMap = new Map(
    quickTrips.map((qt) => [qt.id, qt.title || qt.placeName]),
  )

  const qtExpensesPromise =
    qtIds.length > 0
      ? supabase
          .from('quick_trip_expenses')
          .select('*')
          .in('quick_trip_id', qtIds)
          .order('occurred_at', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as Record<string, unknown>[] })

  const [tripRes, qtRes] = await Promise.all([
    tripExpensesPromise,
    qtExpensesPromise,
  ])

  const items: UnifiedExpenseHistoryItem[] = []

  // Map trip expenses
  for (const r of (tripRes.data ?? []) as Record<string, unknown>[]) {
    items.push({
      id: r.id as string,
      description: (r.title as string) ?? 'Expense',
      amount: toNum(r.amount),
      currency: (r.currency as string) || 'PHP',
      category: (r.category as string) || 'Other',
      date: (r.expense_date as string) ?? '',
      source: 'trip',
      sourceLabel: tripNameMap.get(r.trip_id as string),
      sourceId: r.trip_id as string,
    })
  }

  // Map standalone expenses (already fetched as Expense[])
  for (const e of standaloneExpenses) {
    items.push({
      id: e.id,
      description: e.description || 'Expense',
      amount: e.amount,
      currency: e.currency || 'PHP',
      category: e.category || 'Other',
      date: e.date,
      source: 'standalone',
    })
  }

  // Map quick trip expenses
  for (const r of (qtRes.data ?? []) as Record<string, unknown>[]) {
    items.push({
      id: r.id as string,
      description: (r.description as string) ?? 'Expense',
      amount: toNum(r.amount),
      currency: (r.currency as string) || 'PHP',
      category: 'Other',
      date: (r.occurred_at as string) ?? '',
      source: 'quick-trip',
      sourceLabel: qtNameMap.get(r.quick_trip_id as string),
      sourceId: r.quick_trip_id as string,
    })
  }

  // Sort by date descending, take limit
  items.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
  return items.slice(0, limit)
}
