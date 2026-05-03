import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line as SvgLine, Path } from 'react-native-svg';

import { useRouter } from 'expo-router';
import { useTheme } from '@/constants/ThemeContext';
import { createTrip } from '@/lib/supabase';

// ---------- TYPES ----------

interface AddTripSheetProps {
  open: boolean;
  onClose: () => void;
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

type TripKind = 'upcoming' | 'past';

const SUGGESTED = ['Seoul', 'Bali', 'Taipei', 'Hong Kong', 'Hanoi', 'Kyoto'];

// ---------- COMPONENT ----------

export default function AddTripSheet({ open, onClose }: AddTripSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();

  const [kind, setKind] = useState<TripKind>('upcoming');
  const [dest, setDest] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [members, setMembers] = useState('');
  const [saved, setSaved] = useState(false);

  const slideAnim = useRef(new RNAnimated.Value(0)).current;
  const backdropAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (open) {
      RNAnimated.parallel([
        RNAnimated.timing(slideAnim, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        RNAnimated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
        RNAnimated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Reset after close
      const timer = setTimeout(() => {
        setKind('upcoming');
        setDest('');
        setStart('');
        setEnd('');
        setMembers('');
        setSaved(false);
      }, 240);
      return () => clearTimeout(timer);
    }
  }, [open, slideAnim, backdropAnim]);

  const submit = async () => {
    if (!dest.trim() || !start.trim() || !end.trim()) return;
    try {
      const memberNames = members.trim()
        ? members.split(',').map((n) => n.trim()).filter(Boolean)
        : [];
      await createTrip({
        name: `Trip to ${dest.trim()}`,
        destination: dest.trim(),
        startDate: start.trim(),
        endDate: end.trim(),
        members: memberNames,
      });
      setSaved(true);
      setTimeout(() => onClose(), 900);
    } catch {
      // Show error inline — don't block
      setSaved(false);
    }
  };

  const screenHeight = Dimensions.get('window').height;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, 0],
  });

  if (!open && !saved) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <RNAnimated.View
        style={[
          styles.backdrop,
          { opacity: backdropAnim },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </RNAnimated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrapper}
        pointerEvents="box-none"
      >
        <RNAnimated.View
          style={[
            styles.sheet,
            { transform: [{ translateY }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.eyebrow}>New entry</Text>
                <Text style={styles.headerTitle}>Add a trip</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <SvgLine
                    x1={18} y1={6} x2={6} y2={18}
                    stroke={colors.text}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <SvgLine
                    x1={6} y1={6} x2={18} y2={18}
                    stroke={colors.text}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              </TouchableOpacity>
            </View>

            {/* Scan shortcut */}
            <TouchableOpacity
              style={styles.scanShortcut}
              onPress={() => {
                onClose();
                setTimeout(() => router.push('/scan-trip' as never), 300);
              }}
              activeOpacity={0.7}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M14.5 4l1.5 2h3a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h3l1.5-2z"
                  stroke={colors.accent}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx={12} cy={13} r={3} stroke={colors.accent} strokeWidth={1.8} />
              </Svg>
              <View>
                <Text style={[styles.scanTitle, { color: colors.text }]}>Scan your bookings</Text>
                <Text style={[styles.scanSub, { color: colors.text3 }]}>Upload flight or hotel screenshots to auto-fill</Text>
              </View>
            </TouchableOpacity>

            {/* Kind toggle */}
            <View style={styles.kindToggleWrapper}>
              <View style={styles.segmented}>
                <Pressable
                  style={[
                    styles.segBtn,
                    kind === 'upcoming' && styles.segBtnActive,
                  ]}
                  onPress={() => setKind('upcoming')}
                >
                  <Text
                    style={[
                      styles.segText,
                      kind === 'upcoming' && styles.segTextActive,
                    ]}
                  >
                    Upcoming
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.segBtn,
                    kind === 'past' && styles.segBtnActive,
                  ]}
                  onPress={() => setKind('past')}
                >
                  <Text
                    style={[
                      styles.segText,
                      kind === 'past' && styles.segTextActive,
                    ]}
                  >
                    Past trip
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Fields */}
            <View style={styles.fields}>
              {/* Destination */}
              <View>
                <Text style={styles.fieldLabel}>DESTINATION</Text>
                <TextInput
                  value={dest}
                  onChangeText={setDest}
                  placeholder="e.g. Seoul, Bali, Tokyo"
                  placeholderTextColor={colors.text3}
                  style={styles.input}
                />
                <View style={styles.suggestedRow}>
                  {SUGGESTED.map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setDest(s)}
                      style={styles.suggestedChip}
                    >
                      <Text style={styles.suggestedText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Dates */}
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>
                    {kind === 'past' ? 'STARTED' : 'DEPARTING'}
                  </Text>
                  <TextInput
                    value={start}
                    onChangeText={setStart}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.text3}
                    style={styles.input}
                  />
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>
                    {kind === 'past' ? 'ENDED' : 'RETURNING'}
                  </Text>
                  <TextInput
                    value={end}
                    onChangeText={setEnd}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.text3}
                    style={styles.input}
                  />
                </View>
              </View>

              {/* Traveling with */}
              <View>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>
                    TRAVELING WITH (OPTIONAL)
                  </Text>
                  <Text style={styles.fieldHint}>Comma-separated names</Text>
                </View>
                <TextInput
                  value={members}
                  onChangeText={setMembers}
                  placeholder="e.g. Aaron, Jane"
                  placeholderTextColor={colors.text3}
                  style={styles.input}
                />
              </View>

              {/* Info box for upcoming */}
              {kind === 'upcoming' && (
                <View style={styles.infoBox}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Circle
                      cx={12} cy={12} r={10}
                      stroke={colors.accent}
                      strokeWidth={2}
                    />
                    <SvgLine
                      x1={12} y1={16} x2={12} y2={12}
                      stroke={colors.accent}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    <SvgLine
                      x1={12} y1={8} x2={12.01} y2={8}
                      stroke={colors.accent}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </Svg>
                  <Text style={styles.infoText}>
                    We'll scan your email for flight + hotel bookings matching
                    this trip.
                  </Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submit}
                disabled={!dest.trim() || !start.trim() || !end.trim() || saved}
                style={[
                  styles.submitBtn,
                  (!dest.trim() || !start.trim() || !end.trim() || saved) && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.submitText}>
                  {saved
                    ? '\u2713 Added'
                    : kind === 'past'
                      ? 'Save past trip'
                      : 'Create trip'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </RNAnimated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- STYLES ----------

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(20, 12, 6, 0.42)',
      zIndex: 70,
    },
    sheetWrapper: {
      flex: 1,
      justifyContent: 'flex-end',
      zIndex: 71,
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '88%',
      paddingBottom: 20,
    },
    handleRow: {
      paddingTop: 10,
      alignItems: 'center',
    },
    handle: {
      width: 42,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border2,
    },
    headerRow: {
      paddingTop: 14,
      paddingHorizontal: 20,
      paddingBottom: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '500',
      letterSpacing: -0.6,
      color: colors.text,
      marginTop: 2,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanShortcut: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 20,
      marginTop: 12,
      padding: 14,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 14,
    },
    scanTitle: {
      fontSize: 13,
      fontWeight: '600',
    },
    scanSub: {
      fontSize: 11,
      marginTop: 1,
    },
    kindToggleWrapper: {
      paddingTop: 14,
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    segmented: {
      flexDirection: 'row',
      padding: 3,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      gap: 2,
    },
    segBtn: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 9,
      alignItems: 'center',
    },
    segBtnActive: {
      backgroundColor: colors.card,
    },
    segText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text3,
    },
    segTextActive: {
      color: colors.text,
    },
    fields: {
      paddingHorizontal: 20,
      paddingTop: 8,
      gap: 14,
    },
    fieldLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    fieldLabel: {
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.text3,
      letterSpacing: 1.26,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    fieldHint: {
      fontSize: 10,
      color: colors.text3,
    },
    input: {
      width: '100%',
      paddingVertical: 11,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    suggestedRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },
    suggestedChip: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
    },
    suggestedText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text2,
    },
    dateRow: {
      flexDirection: 'row',
      gap: 10,
    },
    dateField: {
      flex: 1,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 11.5,
      color: colors.text2,
      lineHeight: 16,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      paddingTop: 16,
      paddingHorizontal: 20,
      paddingBottom: 6,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border2,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    submitBtn: {
      flex: 2,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.black,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },
  });
