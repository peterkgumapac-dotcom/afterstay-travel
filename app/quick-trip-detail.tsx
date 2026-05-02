import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Calendar,
  Coffee,
  Dumbbell,
  Heart,
  MapPin,
  Plus,
  Receipt,
  Sparkles,
  Trash2,
  User,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react-native';

import { BentoLayout } from '@/components/moments/BentoLayout';
import { PhotoCarousel } from '@/components/moments/PhotoCarousel';
import type { MomentDisplay } from '@/components/moments/types';
import SwipeableExpenseRow from '@/components/budget/SwipeableExpenseRow';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import {
  getQuickTripById,
  getQuickTripPhotos,
  getQuickTripCompanions,
  getQuickTripExpenses,
  addQuickTripExpense,
  deleteQuickTripExpense,
  deleteQuickTrip,
} from '@/lib/quickTrips';
import { CATEGORY_ICON, type QuickTrip, type QuickTripPhoto, type QuickTripCompanion, type QuickTripExpense } from '@/lib/quickTripTypes';

const ICON_MAP: Record<string, React.ElementType> = {
  Users, Heart, Coffee, User, UtensilsCrossed, Dumbbell, Sparkles,
};
import { formatCurrency, formatDatePHT } from '@/lib/utils';

export default function QuickTripDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { quickTripId } = useLocalSearchParams<{ quickTripId?: string }>();

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<QuickTrip | null>(null);
  const [photos, setPhotos] = useState<QuickTripPhoto[]>([]);
  const [companions, setCompanions] = useState<QuickTripCompanion[]>([]);
  const [expenses, setExpenses] = useState<QuickTripExpense[]>([]);

  // Photo album state
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const momentDisplays: MomentDisplay[] = useMemo(() =>
    photos.map((p) => ({
      id: p.id,
      photo: p.photoUrl,
      caption: '',
      date: p.exifTakenAt ?? trip?.occurredAt ?? '',
      location: trip?.placeName ?? '',
      tags: [],
      visibility: 'shared' as const,
    })),
    [photos, trip],
  );

  // Add expense form
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');

  const load = useCallback(async () => {
    if (!quickTripId) return;
    try {
      const [t, ph, co, ex] = await Promise.all([
        getQuickTripById(quickTripId),
        getQuickTripPhotos(quickTripId),
        getQuickTripCompanions(quickTripId),
        getQuickTripExpenses(quickTripId),
      ]);
      if (t) setTrip(t);
      setPhotos(ph);
      setCompanions(co);
      setExpenses(ex);
    } finally {
      setLoading(false);
    }
  }, [quickTripId]);

  useEffect(() => { load(); }, [load]);

  const totalSpent = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const currency = trip?.totalSpendCurrency ?? 'PHP';

  const handleAddExpense = async () => {
    const amount = parseFloat(expAmount);
    if (!quickTripId || isNaN(amount) || amount <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await addQuickTripExpense({
      quickTripId,
      amount,
      description: expDesc.trim() || undefined,
      currency,
    });
    setExpDesc('');
    setExpAmount('');
    setShowAddExpense(false);
    load();
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!quickTripId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await deleteQuickTripExpense(expenseId, quickTripId);
    load();
  };

  const handleDelete = () => {
    Alert.alert('Delete Quick Trip', 'This will permanently delete this quick trip and all its data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!quickTripId) return;
          await deleteQuickTrip(quickTripId);
          router.canGoBack() ? router.back() : router.replace('/(tabs)/trip' as never);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Quick trip not found</Text>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/trip' as never)} style={styles.backBtnAlt}>
            <Text style={styles.backBtnAltText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const iconName = CATEGORY_ICON[trip.category] ?? 'Sparkles';
  const CatIcon = ICON_MAP[iconName] ?? Sparkles;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/trip' as never)} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Trash2 size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* Photo album */}
        {momentDisplays.length > 0 && (
          <View style={styles.albumSection}>
            <BentoLayout
              items={momentDisplays}
              onOpen={(m) => {
                const idx = momentDisplays.findIndex((d) => d.id === m.id);
                setCarouselIndex(idx >= 0 ? idx : 0);
                setCarouselVisible(true);
              }}
              selectedIds={new Set()}
              onToggleSelect={() => {}}
              selectMode={false}
              onLongPress={() => {}}
            />
          </View>
        )}

        {/* Fullscreen photo viewer */}
        <Modal
          visible={carouselVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setCarouselVisible(false)}
        >
          <PhotoCarousel
            moments={momentDisplays}
            initialIndex={carouselIndex}
            people={{}}
            onClose={() => setCarouselVisible(false)}
          />
        </Modal>

        {/* Title + meta */}
        <View style={styles.titleSection}>
          <View style={styles.catPill}>
            <CatIcon size={14} color={colors.accent} strokeWidth={2} />
            <Text style={styles.catLabel}>{trip.category}</Text>
          </View>
          <Text style={styles.title}>{trip.title}</Text>
          <View style={styles.metaRow}>
            <MapPin size={13} color={colors.text3} />
            <Text style={styles.metaText}>{trip.placeName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Calendar size={13} color={colors.text3} />
            <Text style={styles.metaText}>{formatDatePHT(trip.occurredAt)}</Text>
          </View>
        </View>

        {/* Companions */}
        {companions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Users size={14} color={colors.text3} />
              <Text style={styles.sectionLabel}>Companions</Text>
            </View>
            <View style={styles.companionRow}>
              {companions.map((c) => (
                <View key={c.id} style={styles.companionChip}>
                  <Text style={styles.companionInitial}>{c.displayName[0]?.toUpperCase()}</Text>
                  <Text style={styles.companionName}>{c.displayName}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Budget Section — always present */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Wallet size={14} color={colors.text3} />
            <Text style={styles.sectionLabel}>Budget</Text>
          </View>

          <View style={styles.budgetHeader}>
            <Text style={styles.budgetTotal}>{formatCurrency(totalSpent, currency)}</Text>
            <Text style={styles.budgetSub}>
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Expense list */}
          {expenses.map((e) => (
            <SwipeableExpenseRow
              key={e.id}
              colors={colors}
              onEdit={() => {}}
              onDelete={() => handleDeleteExpense(e.id)}
            >
              <View style={styles.expenseRow}>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseDesc} numberOfLines={1}>
                    {e.description || 'Expense'}
                  </Text>
                  <Text style={styles.expenseDate}>{formatDatePHT(e.occurredAt)}</Text>
                </View>
                <Text style={styles.expenseAmount}>{formatCurrency(e.amount, e.currency)}</Text>
              </View>
            </SwipeableExpenseRow>
          ))}

          {/* Add expense */}
          {showAddExpense ? (
            <View style={styles.addExpenseForm}>
              <TextInput
                style={styles.addExpInput}
                value={expDesc}
                onChangeText={setExpDesc}
                placeholder="What was it?"
                placeholderTextColor={colors.text3}
              />
              <View style={styles.addExpAmountRow}>
                <Text style={styles.addExpCurrency}>{currency}</Text>
                <TextInput
                  style={[styles.addExpInput, { flex: 1 }]}
                  value={expAmount}
                  onChangeText={setExpAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.text3}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity onPress={handleAddExpense} style={styles.addExpSaveBtn}>
                  <Text style={styles.addExpSaveText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addExpenseBtn}
              onPress={() => setShowAddExpense(true)}
              activeOpacity={0.7}
            >
              <Plus size={16} color={colors.accent} />
              <Text style={styles.addExpenseText}>Add expense</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notes */}
        {trip.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notesText}>{trip.notes}</Text>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    emptyText: { fontSize: 15, color: colors.text3 },
    backBtnAlt: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card },
    backBtnAltText: { fontSize: 14, fontWeight: '600', color: colors.accent },
    scroll: { paddingHorizontal: 20, paddingTop: 8 },

    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    backBtn: {
      width: 36, height: 36, borderRadius: 12, backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    },
    deleteBtn: {
      width: 36, height: 36, borderRadius: 12, backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    },

    albumSection: { marginBottom: 20, marginHorizontal: -20 },

    titleSection: { marginBottom: 24 },
    catPill: {
      flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5,
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
      backgroundColor: colors.accentBg, marginBottom: 10,
    },
    catEmoji: { fontSize: 13 },
    catLabel: { fontSize: 11, fontWeight: '600', color: colors.accent, textTransform: 'capitalize' },
    title: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.5, marginBottom: 8 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    metaText: { fontSize: 13, color: colors.text3 },

    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    sectionLabel: {
      fontSize: 11, fontWeight: '600', color: colors.text3,
      textTransform: 'uppercase', letterSpacing: 1.4,
    },

    companionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    companionChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingLeft: 4, paddingRight: 10, paddingVertical: 6,
      borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    companionInitial: {
      width: 24, height: 24, borderRadius: 8, backgroundColor: colors.accentDim,
      textAlign: 'center', lineHeight: 24, fontSize: 12, fontWeight: '700', color: colors.accent, overflow: 'hidden',
    },
    companionName: { fontSize: 12, fontWeight: '600', color: colors.text },

    budgetHeader: { marginBottom: 14 },
    budgetTotal: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
    budgetSub: { fontSize: 12, color: colors.text3, marginTop: 2 },

    expenseRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 12, paddingHorizontal: 14,
      backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      marginBottom: 6,
    },
    expenseInfo: { flex: 1, marginRight: 12 },
    expenseDesc: { fontSize: 13, fontWeight: '600', color: colors.text },
    expenseDate: { fontSize: 11, color: colors.text3, marginTop: 2 },
    expenseAmount: { fontSize: 14, fontWeight: '700', color: colors.text },

    addExpenseBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 12, borderRadius: 12,
      borderWidth: 1.5, borderColor: colors.accentBorder, borderStyle: 'dashed',
      marginTop: 4,
    },
    addExpenseText: { fontSize: 13, fontWeight: '600', color: colors.accent },

    addExpenseForm: {
      padding: 14, borderRadius: 14, backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.accentBorder, gap: 10, marginTop: 4,
    },
    addExpInput: {
      fontSize: 14, color: colors.text, paddingVertical: 8, paddingHorizontal: 12,
      backgroundColor: colors.card2, borderRadius: 10,
    },
    addExpAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addExpCurrency: { fontSize: 14, fontWeight: '600', color: colors.text3 },
    addExpSaveBtn: {
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.accent,
    },
    addExpSaveText: { fontSize: 13, fontWeight: '700', color: '#fff' },

    notesText: { fontSize: 14, color: colors.text2, lineHeight: 20 },
  });
