import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowRight, CheckCircle, QrCode, Send, Users, X } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import {
  getTripBalances,
  getTripSplits,
  settleExpenseSplit,
  getPaymentQrs,
} from '@/lib/supabase';
import type { MemberBalance, PaymentQr } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import type { Expense, GroupMember, Trip } from '@/lib/types';
import type { ExpenseSplit } from '@/lib/supabase';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

// ── Helpers ─────────────────────────────────────────────────────────

interface DebtEdge {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

function computeDebts(balances: MemberBalance[]): DebtEdge[] {
  const debtors = balances.filter((b) => b.net < -1).map((b) => ({ ...b }));
  const creditors = balances.filter((b) => b.net > 1).map((b) => ({ ...b }));

  debtors.sort((a, b) => a.net - b.net);
  creditors.sort((a, b) => b.net - a.net);

  const edges: DebtEdge[] = [];
  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di];
    const c = creditors[ci];
    const amount = Math.min(Math.abs(d.net), c.net);
    if (amount > 1) {
      edges.push({
        from: d.memberId,
        fromName: d.memberName.split(' ')[0],
        to: c.memberId,
        toName: c.memberName.split(' ')[0],
        amount,
      });
    }
    d.net += amount;
    c.net -= amount;
    if (Math.abs(d.net) < 1) di++;
    if (c.net < 1) ci++;
  }

  return edges;
}

function computeInsights(expenses: Expense[], members: GroupMember[], balances: MemberBalance[], splits: ExpenseSplit[]): string[] {
  const insights: string[] = [];

  // Who covered most per category
  const catTotals: Record<string, Record<string, number>> = {};
  for (const e of expenses) {
    const cat = e.category ?? 'Other';
    const payer = e.paidBy ?? 'Unknown';
    if (!catTotals[cat]) catTotals[cat] = {};
    catTotals[cat][payer] = (catTotals[cat][payer] ?? 0) + e.amount;
  }

  for (const [cat, byPayer] of Object.entries(catTotals)) {
    const entries = Object.entries(byPayer);
    if (entries.length < 2) continue;
    entries.sort(([, a], [, b]) => b - a);
    const [topPayer] = entries[0];
    const firstName = topPayer.split(' ')[0];
    const label = cat === 'Food' ? 'food' : cat === 'Transport' ? 'transport' : cat === 'Activity' ? 'activities' : cat === 'Shopping' ? 'shopping' : cat.toLowerCase();
    insights.push(`${firstName} covered most ${label}`);
  }

  // Who has unsettled splits
  const unsettledByMember: Record<string, number> = {};
  for (const s of splits) {
    if (!s.settled) {
      unsettledByMember[s.memberName] = (unsettledByMember[s.memberName] ?? 0) + 1;
    }
  }
  for (const [name, count] of Object.entries(unsettledByMember)) {
    if (count >= 2) {
      insights.push(`${name.split(' ')[0]} has ${count} unsettled splits`);
    }
  }

  // Most generous payer
  const biggestPayer = balances.reduce((top, b) => b.totalPaid > top.totalPaid ? b : top, balances[0]);
  if (biggestPayer && biggestPayer.totalPaid > 0 && members.length >= 2) {
    insights.push(`${biggestPayer.memberName.split(' ')[0]} paid the most overall`);
  }

  return insights.slice(0, 3);
}

// ── Props ───────────────────────────────────────────────────────────

interface GroupBalanceCardProps {
  trip: Trip;
  expenses: Expense[];
  members: GroupMember[];
  onBalancesChange?: (balances: MemberBalance[]) => void;
}

export function GroupBalanceCard({ trip, expenses, members, onBalancesChange }: GroupBalanceCardProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const currency = trip.costCurrency ?? 'PHP';

  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [paymentQrs, setPaymentQrs] = useState<PaymentQr[]>([]);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleEdge, setSettleEdge] = useState<DebtEdge | null>(null);
  const [settling, setSettling] = useState(false);

  // Load balances + splits
  const loadBalances = useCallback(async () => {
    if (!trip.id || expenses.length === 0 || members.length < 2) return;
    try {
      const [bals, sp] = await Promise.all([
        getTripBalances(trip.id, expenses, members),
        getTripSplits(trip.id),
      ]);
      setBalances(bals);
      setSplits(sp);
      onBalancesChange?.(bals);
    } catch {}
  }, [trip.id, expenses, members, onBalancesChange]);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  // Load QRs
  useEffect(() => {
    if (trip.id) getPaymentQrs(trip.id).then(setPaymentQrs).catch(() => {});
  }, [trip.id]);

  const debts = useMemo(() => computeDebts(balances), [balances]);
  const insights = useMemo(() => computeInsights(expenses, members, balances, splits), [expenses, members, balances, splits]);

  const youOwe = useMemo(() => debts.filter((d) => {
    const me = members.find((m) => m.role === 'Primary');
    return me && d.from === me.id;
  }), [debts, members]);

  const owedToYou = useMemo(() => debts.filter((d) => {
    const me = members.find((m) => m.role === 'Primary');
    return me && d.to === me.id;
  }), [debts, members]);

  const otherDebts = useMemo(() => debts.filter((d) => {
    const me = members.find((m) => m.role === 'Primary');
    return me && d.from !== me.id && d.to !== me.id;
  }), [debts, members]);

  // Settle all unsettled splits for a debtor→creditor pair
  const handleSettle = useCallback(async (edge: DebtEdge) => {
    setSettling(true);
    try {
      const relevant = splits.filter(
        (sp) => !sp.settled && sp.memberId === edge.from
      );
      // Find expenses paid by the creditor
      const creditorExpenseIds = new Set(
        expenses.filter((e) => {
          const payer = members.find((m) => m.name === e.paidBy);
          return payer && payer.id === edge.to;
        }).map((e) => e.id),
      );
      const toSettle = relevant.filter((sp) => creditorExpenseIds.has(sp.expenseId));

      for (const sp of toSettle) {
        await settleExpenseSplit(sp.id);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSettleModal(false);
      setSettleEdge(null);
      await loadBalances();
    } catch {
      Alert.alert('Error', 'Failed to settle. Try again.');
    } finally {
      setSettling(false);
    }
  }, [splits, expenses, members, loadBalances]);

  const openSettleFlow = useCallback((edge: DebtEdge) => {
    setSettleEdge(edge);
    setShowSettleModal(true);
  }, []);

  if (members.length < 2) {
    return (
      <View style={s.emptyWrap}>
        <Users size={28} color={colors.text3} strokeWidth={1.5} />
        <Text style={s.emptyTitle}>No group yet</Text>
        <Text style={s.emptySub}>Add trip members to track who owes whom.</Text>
      </View>
    );
  }

  const allSettled = debts.length === 0;
  const totalGroupSpend = balances.reduce((sum, b) => sum + b.totalPaid, 0);

  return (
    <View style={{ gap: 16 }}>
      {/* ── Net Balance Summary ── */}
      <View style={s.summaryCard}>
        <Text style={s.summaryEyebrow}>GROUP BALANCE</Text>
        <Text style={s.summaryAmount}>
          {formatCurrency(totalGroupSpend, currency)}
        </Text>
        <Text style={s.summarySub}>
          total spent by {members.length} members
        </Text>
        {allSettled && (
          <View style={s.settledBadge}>
            <CheckCircle size={14} color={colors.success} strokeWidth={2} />
            <Text style={s.settledBadgeText}>All settled up!</Text>
          </View>
        )}
      </View>

      {/* ── You Owe ── */}
      {youOwe.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.danger }]}>YOU OWE</Text>
          {youOwe.map((edge) => (
            <DebtRow
              key={`${edge.from}-${edge.to}`}
              edge={edge}
              currency={currency}
              colors={colors}
              direction="owe"
              onSettle={() => openSettleFlow(edge)}
            />
          ))}
        </View>
      )}

      {/* ── Owed to You ── */}
      {owedToYou.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.success }]}>OWED TO YOU</Text>
          {owedToYou.map((edge) => (
            <DebtRow
              key={`${edge.from}-${edge.to}`}
              edge={edge}
              currency={currency}
              colors={colors}
              direction="owed"
              onRemind={() => {
                Alert.alert(
                  'Remind',
                  `Send ${edge.fromName} a reminder for ${formatCurrency(edge.amount, currency)}?`,
                  [
                    { text: 'Not now', style: 'cancel' },
                    { text: 'Remind', onPress: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
                  ],
                );
              }}
            />
          ))}
        </View>
      )}

      {/* ── Between Others ── */}
      {otherDebts.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.text3 }]}>BETWEEN OTHERS</Text>
          {otherDebts.map((edge) => (
            <DebtRow
              key={`${edge.from}-${edge.to}`}
              edge={edge}
              currency={currency}
              colors={colors}
              direction="other"
            />
          ))}
        </View>
      )}

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <View style={s.insightsCard}>
          <Text style={s.insightsTitle}>Spending insights</Text>
          {insights.map((text, i) => (
            <View key={i} style={s.insightRow}>
              <View style={[s.insightDot, { backgroundColor: i === 0 ? colors.accent : i === 1 ? colors.chart2 : colors.chart3 }]} />
              <Text style={s.insightText}>{text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Per-Member Breakdown ── */}
      <View style={s.breakdownCard}>
        <Text style={s.breakdownTitle}>Member breakdown</Text>
        {balances.filter((b) => b.totalPaid > 0 || b.totalOwed > 0).map((b) => {
          const isPositive = b.net > 1;
          const isNegative = b.net < -1;
          return (
            <View key={b.memberId} style={s.memberRow}>
              <View style={[s.memberAvatar, { backgroundColor: isPositive ? colors.accentDim : isNegative ? `${colors.danger}22` : colors.card2 }]}>
                <Text style={s.memberAvatarText}>{b.memberName.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.memberName}>{b.memberName.split(' ')[0]}</Text>
                <Text style={s.memberDetail}>
                  Paid {formatCurrency(b.totalPaid, currency)} · Owes {formatCurrency(b.totalOwed, currency)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.memberNet, {
                  color: isPositive ? colors.success : isNegative ? colors.danger : colors.text3,
                }]}>
                  {isPositive ? '+' : ''}{formatCurrency(b.net, currency)}
                </Text>
                {b.settled > 0 && (
                  <Text style={s.memberSettled}>
                    {formatCurrency(b.settled, currency)} settled
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Settle Up Modal ── */}
      <Modal visible={showSettleModal} transparent animationType="fade" onRequestClose={() => setShowSettleModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Settle Up</Text>
              <TouchableOpacity onPress={() => setShowSettleModal(false)} hitSlop={12}>
                <X size={20} color={colors.text3} />
              </TouchableOpacity>
            </View>

            {settleEdge && (
              <>
                <View style={s.settleFlow}>
                  <View style={s.settleFlowPerson}>
                    <View style={[s.memberAvatar, { backgroundColor: `${colors.danger}22`, width: 44, height: 44 }]}>
                      <Text style={[s.memberAvatarText, { fontSize: 17 }]}>{settleEdge.fromName.charAt(0)}</Text>
                    </View>
                    <Text style={s.settleFlowName}>{settleEdge.fromName}</Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <ArrowRight size={20} color={colors.accent} />
                    <Text style={s.settleFlowAmount}>{formatCurrency(settleEdge.amount, currency)}</Text>
                  </View>
                  <View style={s.settleFlowPerson}>
                    <View style={[s.memberAvatar, { backgroundColor: colors.accentDim, width: 44, height: 44 }]}>
                      <Text style={[s.memberAvatarText, { fontSize: 17 }]}>{settleEdge.toName.charAt(0)}</Text>
                    </View>
                    <Text style={s.settleFlowName}>{settleEdge.toName}</Text>
                  </View>
                </View>

                {/* Show QR if available */}
                {paymentQrs.length > 0 && (
                  <View style={s.qrSection}>
                    <View style={s.qrRow}>
                      <QrCode size={16} color={colors.accent} />
                      <Text style={s.qrLabel}>Scan to pay</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      {paymentQrs.map((qr, idx) => (
                        <View key={`qr-${idx}`} style={s.qrThumb}>
                          <Image source={{ uri: qr.uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                          <Text style={s.qrThumbLabel} numberOfLines={1}>{qr.label}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={s.modalActions}>
                  <TouchableOpacity
                    style={s.settleConfirmBtn}
                    onPress={() => handleSettle(settleEdge)}
                    disabled={settling}
                    activeOpacity={0.7}
                  >
                    <CheckCircle size={16} color="#fff" strokeWidth={2.5} />
                    <Text style={s.settleConfirmText}>
                      {settling ? 'Settling...' : 'Mark as Settled'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.cancelBtn}
                    onPress={() => setShowSettleModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── DebtRow ─────────────────────────────────────────────────────────

interface DebtRowProps {
  edge: DebtEdge;
  currency: string;
  colors: ThemeColors;
  direction: 'owe' | 'owed' | 'other';
  onSettle?: () => void;
  onRemind?: () => void;
}

function DebtRow({ edge, currency, colors, direction, onSettle, onRemind }: DebtRowProps) {
  const s = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={s.debtRow}>
      <View style={[s.memberAvatar, {
        backgroundColor: direction === 'owe' ? `${colors.danger}22` : direction === 'owed' ? colors.accentDim : colors.card2,
      }]}>
        <Text style={s.memberAvatarText}>
          {direction === 'owe' ? edge.fromName.charAt(0) : edge.toName.charAt(0)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.debtNames}>
          {direction === 'owe' && (
            <>
              <Text style={{ fontWeight: '700' }}>You</Text>
              {' → '}
              <Text>{edge.toName}</Text>
            </>
          )}
          {direction === 'owed' && (
            <>
              <Text style={{ fontWeight: '700' }}>{edge.fromName}</Text>
              {' → '}
              <Text>You</Text>
            </>
          )}
          {direction === 'other' && (
            <>
              <Text>{edge.fromName}</Text>
              {' → '}
              <Text>{edge.toName}</Text>
            </>
          )}
        </Text>
        <Text style={[s.debtAmount, {
          color: direction === 'owe' ? colors.danger : direction === 'owed' ? colors.success : colors.text2,
        }]}>
          {formatCurrency(edge.amount, currency)}
        </Text>
      </View>

      {direction === 'owe' && onSettle && (
        <TouchableOpacity style={s.settleBtn} onPress={onSettle} activeOpacity={0.7}>
          <Text style={s.settleBtnText}>Settle</Text>
        </TouchableOpacity>
      )}
      {direction === 'owed' && onRemind && (
        <TouchableOpacity style={s.remindBtn} onPress={onRemind} activeOpacity={0.7}>
          <Send size={14} color={colors.accent} />
          <Text style={s.remindBtnText}>Remind</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const getStyles = (c: ThemeColors) => StyleSheet.create({
  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: c.text },
  emptySub: { fontSize: 13, color: c.text3, textAlign: 'center' },

  // Summary
  summaryCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 22, padding: 20, alignItems: 'center' },
  summaryEyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 1.6, color: c.text3, textTransform: 'uppercase' },
  summaryAmount: { fontSize: 32, fontWeight: '500', letterSpacing: -0.5, color: c.text, marginTop: 4 },
  summarySub: { fontSize: 12, color: c.text3, marginTop: 4 },
  settledBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: `${c.success}18`, borderRadius: 20 },
  settledBadgeText: { fontSize: 12, fontWeight: '600', color: c.success },

  // Sections
  section: { gap: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 2 },

  // Debt rows
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14 },
  debtNames: { fontSize: 13, color: c.text },
  debtAmount: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3, marginTop: 2 },
  settleBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: c.accent, borderRadius: radius.sm },
  settleBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  remindBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: c.accentBorder, borderRadius: radius.sm },
  remindBtnText: { fontSize: 12, fontWeight: '600', color: c.accent },

  // Insights
  insightsCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, gap: 10 },
  insightsTitle: { fontSize: 13, fontWeight: '600', color: c.text },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  insightDot: { width: 6, height: 6, borderRadius: 3 },
  insightText: { fontSize: 13, color: c.text2 },

  // Breakdown
  breakdownCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, gap: 12 },
  breakdownTitle: { fontSize: 13, fontWeight: '600', color: c.text },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 14, fontWeight: '700', color: '#fffaf0' },
  memberName: { fontSize: 13, fontWeight: '600', color: c.text },
  memberDetail: { fontSize: 11, color: c.text3, marginTop: 1 },
  memberNet: { fontSize: 14, fontWeight: '700', letterSpacing: -0.3 },
  memberSettled: { fontSize: 10, color: c.text3, marginTop: 1 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '88%', backgroundColor: c.bg2, borderRadius: radius.xl, padding: 24, borderWidth: 1, borderColor: c.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  settleFlow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 16 },
  settleFlowPerson: { alignItems: 'center', gap: 6 },
  settleFlowName: { fontSize: 13, fontWeight: '600', color: c.text },
  settleFlowAmount: { fontSize: 18, fontWeight: '700', color: c.accent, letterSpacing: -0.3 },
  qrSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qrLabel: { fontSize: 12, fontWeight: '600', color: c.accent },
  qrThumb: { alignItems: 'center', marginRight: 12, gap: 4 },
  qrThumbLabel: { fontSize: 10, color: c.text3, maxWidth: 64 },
  modalActions: { gap: 10, marginTop: 20 },
  settleConfirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: c.accent, borderRadius: radius.md },
  settleConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: c.text3 },
});
