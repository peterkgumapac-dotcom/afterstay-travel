import type { Expense, GroupMember } from '@/lib/types';
import type { ExpenseSplit } from '@/lib/supabase';

export interface BudgetDebtEdge {
  fromMemberId: string;
  fromName: string;
  fromUserId?: string;
  toMemberId: string;
  toName: string;
  toUserId?: string;
  amount: number;
  splitIds: string[];
}

export function displayBudgetMemberName(name?: string | null): string {
  const cleaned = (name ?? '').replace(/^\[QA\s+\d{8}\]\s*/i, '').trim();
  const first = cleaned.split(/\s+/).find(Boolean);
  return first || 'Traveler';
}

export function budgetMemberInitial(name?: string | null): string {
  return displayBudgetMemberName(name).charAt(0).toUpperCase();
}

export function resolveExpensePayerMemberId(expense: Expense, members: GroupMember[]): string | undefined {
  const paidBy = expense.paidBy?.trim();
  if (!paidBy) return undefined;

  const byId = members.find((member) => member.id === paidBy);
  if (byId) return byId.id;

  const normalized = paidBy.toLowerCase();
  const byName = members.filter((member) => member.name.trim().toLowerCase() === normalized);
  return byName.length === 1 ? byName[0].id : undefined;
}

export function computeUnsettledDebtEdges(
  expenses: Expense[],
  members: GroupMember[],
  splits: ExpenseSplit[],
): BudgetDebtEdge[] {
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]));
  const memberById = new Map(members.map((member) => [member.id, member]));
  const edges = new Map<string, BudgetDebtEdge>();

  for (const split of splits) {
    if (split.settled || split.amount <= 0) continue;
    const expense = expenseById.get(split.expenseId);
    if (!expense) continue;

    const creditorId = resolveExpensePayerMemberId(expense, members);
    if (!creditorId || creditorId === split.memberId) continue;

    const debtor = memberById.get(split.memberId);
    const creditor = memberById.get(creditorId);
    if (!debtor || !creditor) continue;

    const key = `${split.memberId}->${creditorId}`;
    const current = edges.get(key);
    if (current) {
      current.amount += split.amount;
      current.splitIds.push(split.id);
    } else {
      edges.set(key, {
        fromMemberId: split.memberId,
        fromName: displayBudgetMemberName(debtor.name || split.memberName),
        fromUserId: debtor.userId,
        toMemberId: creditorId,
        toName: displayBudgetMemberName(creditor.name),
        toUserId: creditor.userId,
        amount: split.amount,
        splitIds: [split.id],
      });
    }
  }

  return [...edges.values()].sort((a, b) => b.amount - a.amount);
}

export function summarizeDebtEdges(edges: BudgetDebtEdge[], currentMemberId?: string) {
  const owedToUser = currentMemberId
    ? edges.filter((edge) => edge.toMemberId === currentMemberId)
    : [];
  const userOwes = currentMemberId
    ? edges.filter((edge) => edge.fromMemberId === currentMemberId)
    : [];
  const betweenOthers = currentMemberId
    ? edges.filter((edge) => edge.fromMemberId !== currentMemberId && edge.toMemberId !== currentMemberId)
    : edges;

  return {
    owedToUser,
    userOwes,
    betweenOthers,
    owedToUserTotal: owedToUser.reduce((sum, edge) => sum + edge.amount, 0),
    userOwesTotal: userOwes.reduce((sum, edge) => sum + edge.amount, 0),
  };
}
