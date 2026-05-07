import { supabase, getAllUserTrips, getStandaloneExpenses } from './supabase'
import { getQuickTrips } from './quickTrips'
import type { UnifiedExpenseHistoryItem } from './types'

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function mapQuickTripCategory(category?: string): UnifiedExpenseHistoryItem['category'] {
  if (category === 'food' || category === 'coffee') return 'Food'
  if (category === 'activity') return 'Activity'
  return 'Other'
}

function mapQuickTripSplitType(splitType?: string): UnifiedExpenseHistoryItem['splitType'] | undefined {
  if (splitType === 'even') return 'Equal'
  if (splitType === 'custom') return 'Custom'
  return undefined
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
  const qtCategoryMap = new Map(quickTrips.map((qt) => [qt.id, qt.category]))

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

  const standaloneExpenseIds = standaloneExpenses.map((e) => e.id).filter(Boolean)
  const tripExpenseRows = (tripRes.data ?? []) as Record<string, unknown>[]
  const tripExpenseIds = tripExpenseRows.map((r) => r.id as string).filter(Boolean)
  const qtExpenseRows = (qtRes.data ?? []) as Record<string, unknown>[]
  const qtExpenseIds = qtExpenseRows.map((r) => r.id as string).filter(Boolean)
  const [standaloneSplitRes, tripSplitRes, qtCompanionRes, qtSplitRes] = await Promise.all([
    standaloneExpenseIds.length > 0
      ? supabase
          .from('standalone_expense_splits')
          .select('expense_id, person_name, amount, settled, settled_at')
          .in('expense_id', standaloneExpenseIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    tripExpenseIds.length > 0
      ? supabase
          .from('expense_splits')
          .select('expense_id, member_name, amount, settled, settled_at')
          .in('expense_id', tripExpenseIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    qtIds.length > 0
      ? supabase
          .from('quick_trip_companions')
          .select('id, quick_trip_id, display_name')
          .in('quick_trip_id', qtIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    qtExpenseIds.length > 0
      ? supabase
          .from('quick_trip_expense_splits')
          .select('quick_trip_expense_id, companion_id, amount_owed, settled_at')
          .in('quick_trip_expense_id', qtExpenseIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  const standaloneSplitsByExpense = new Map<string, Record<string, unknown>[]>()
  for (const split of (standaloneSplitRes.data ?? []) as Record<string, unknown>[]) {
    const expenseId = split.expense_id as string
    const rows = standaloneSplitsByExpense.get(expenseId) ?? []
    rows.push(split)
    standaloneSplitsByExpense.set(expenseId, rows)
  }

  const tripSplitsByExpense = new Map<string, Record<string, unknown>[]>()
  for (const split of (tripSplitRes.data ?? []) as Record<string, unknown>[]) {
    const expenseId = split.expense_id as string
    const rows = tripSplitsByExpense.get(expenseId) ?? []
    rows.push(split)
    tripSplitsByExpense.set(expenseId, rows)
  }

  const companionNameMap = new Map<string, string>()
  for (const c of (qtCompanionRes.data ?? []) as Record<string, unknown>[]) {
    companionNameMap.set(c.id as string, (c.display_name as string) ?? 'Traveler')
  }

  const splitsByExpense = new Map<string, Record<string, unknown>[]>()
  for (const split of (qtSplitRes.data ?? []) as Record<string, unknown>[]) {
    const expenseId = split.quick_trip_expense_id as string
    const rows = splitsByExpense.get(expenseId) ?? []
    rows.push(split)
    splitsByExpense.set(expenseId, rows)
  }

  const items: UnifiedExpenseHistoryItem[] = []

  // Map trip expenses
  for (const r of tripExpenseRows) {
    const expenseSplits = tripSplitsByExpense.get(r.id as string) ?? []
    const splitSummary = expenseSplits
      .map((split) => {
        const settled = split.settled || split.settled_at ? ' settled' : ''
        return `${(split.member_name as string) ?? 'Traveler'}: ${(r.currency as string) || 'PHP'} ${toNum(split.amount).toFixed(2)}${settled}`
      })
      .join('\n')

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
      paidBy: (r.paid_by as string) ?? undefined,
      splitType: (r.split_type as string) ?? undefined,
      notes: splitSummary ? `Split:\n${splitSummary}` : (r.notes as string) ?? undefined,
    })
  }

  // Map standalone expenses (already fetched as Expense[])
  for (const e of standaloneExpenses) {
    const expenseSplits = standaloneSplitsByExpense.get(e.id) ?? []
    const splitSummary = expenseSplits
      .map((split) => {
        const settled = split.settled || split.settled_at ? ' settled' : ''
        return `${(split.person_name as string) ?? 'Friend'}: ${e.currency || 'PHP'} ${toNum(split.amount).toFixed(2)}${settled}`
      })
      .join('\n')

    items.push({
      id: e.id,
      description: e.description || 'Expense',
      amount: e.amount,
      currency: e.currency || 'PHP',
      category: e.category || 'Other',
      date: e.date,
      source: 'standalone',
      paidBy: e.paidBy,
      splitType: e.splitType,
      placeName: e.placeName,
      notes: splitSummary ? `Split:\n${splitSummary}` : e.notes,
    })
  }

  // Map quick trip expenses
  for (const r of qtExpenseRows) {
    const expenseSplits = splitsByExpense.get(r.id as string) ?? []
    const splitSummary = expenseSplits
      .map((split) => {
        const name = companionNameMap.get(split.companion_id as string) ?? 'Traveler'
        const settled = split.settled_at ? ' settled' : ''
        return `${name}: ${(r.currency as string) || 'PHP'} ${toNum(split.amount_owed).toFixed(2)}${settled}`
      })
      .join('\n')

    items.push({
      id: r.id as string,
      description: (r.description as string) ?? 'Expense',
      amount: toNum(r.amount),
      currency: (r.currency as string) || 'PHP',
      category: mapQuickTripCategory(qtCategoryMap.get(r.quick_trip_id as string)),
      date: (r.occurred_at as string) ?? '',
      source: 'quick-trip',
      sourceLabel: qtNameMap.get(r.quick_trip_id as string),
      sourceId: r.quick_trip_id as string,
      paidBy: companionNameMap.get(r.paid_by_companion_id as string),
      splitType: mapQuickTripSplitType(r.split_type as string | undefined),
      notes: splitSummary ? `Split:\n${splitSummary}` : undefined,
    })
  }

  // Sort by date descending, take limit
  items.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
  return items.slice(0, limit)
}
