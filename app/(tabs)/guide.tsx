import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Building2,
  Edit3,
  ExternalLink,
  MapPin,
  Phone,
  Plane,
  ShieldCheck,
  Sparkles,
  Wifi,
  Waves,
  UtensilsCrossed,
  Dumbbell,
  Bus,
  Coffee,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import Card from '@/components/Card';
import Pill from '@/components/Pill';
import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { getActiveTrip, getFlights, getSavedPlaces, updateTripProperty } from '@/lib/supabase';
import type { Flight, Place, Trip } from '@/lib/types';
import { HOTEL_COORDS, NEARBY_ESSENTIALS } from '@/lib/boracayData';
import { sanitizeText } from '@/lib/sanitize';

const TAB_KEYS = ['Property', 'Nearby', 'Notes'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const AMENITY_ICONS: Record<string, React.ComponentType<any>> = {
  'Pool': Waves,
  'WiFi': Wifi,
  'Breakfast': UtensilsCrossed,
  'Gym': Dumbbell,
  'Shuttle': Bus,
  'Spa': Coffee,
};

export default function GuideScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [activeTab, setActiveTab] = useState<TabKey>('Property');
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const DEFAULT_NOTES_TEMPLATE = `AIRPORT & TRAVEL RULES:
\u2022 Arrive at NAIA 2 hours before domestic flight
\u2022 Cabin baggage: 7kg max, 56\u00D736\u00D723cm
\u2022 Peter: 20kg checked (outbound only)
\u2022 Aaron & Jane: NO checked bags
\u2022 Tickets non-changeable, non-refundable
\u2022 Valid ID required for domestic flights

HOTEL CHECK-IN:
\u2022 Photo ID + credit card required
\u2022 \u20B12,000 refundable deposit (cash)
\u2022 Booking ref: Agoda #1712826310
\u2022 24-hour check-in available
\u2022 Luggage storage available

EMERGENCY:
\u2022 Hotel: +63 36 286 2320
\u2022 Island Clinic: 830m from hotel`;

  const load = useCallback(async () => {
    try {
      setError(undefined);
      const t = await getActiveTrip();
      setTrip(t);
      if (t) {
        const [fs, ps] = await Promise.all([
          getFlights(t.id).catch(() => [] as Flight[]),
          getSavedPlaces(t.id).catch(() => [] as Place[]),
        ]);
        setFlights(fs);
        setPlaces(ps);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load guide');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.accentLt} />
      </SafeAreaView>
    );
  }

  if (error || !trip) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'No trip found.'}</Text>
      </SafeAreaView>
    );
  }

  const essentials = places.filter(p => p.category === 'Essentials');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.pageTitle}>Guide</Text>
        <Text style={styles.pageSub}>{trip.accommodation}</Text>
      </View>

      {/* Segmented control */}
      <View style={styles.segmented}>
        {TAB_KEYS.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.segBtn, activeTab === tab && styles.segBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.segText, activeTab === tab && styles.segTextActive]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.accentLt}
          />
        }
      >
        {activeTab === 'Property' && (
          <>
            {/* Property info */}
            <Card>
              <Text style={styles.propName}>{trip.accommodation}</Text>
              {trip.address ? (
                <View style={styles.hotelAddressRow}>
                  <MapPin size={14} color={colors.text2} />
                  <Text style={styles.hotelAddress}>{trip.address}</Text>
                </View>
              ) : null}

              {/* Check-in/out times */}
              <View style={styles.timesGrid}>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>CHECK-IN</Text>
                  <Text style={styles.timeValue}>{trip.checkIn || '3:00 PM'}</Text>
                </View>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>CHECKOUT</Text>
                  <Text style={styles.timeValue}>{trip.checkOut || '12:00 PM'}</Text>
                </View>
              </View>

              {/* Amenities grid */}
              {trip.amenities && trip.amenities.length > 0 ? (
                <View style={styles.amenities}>
                  <Text style={styles.subheader}>Amenities</Text>
                  <View style={styles.amenityGrid}>
                    {trip.amenities.map(a => {
                      const AmenIcon = AMENITY_ICONS[a];
                      return (
                        <View key={a} style={styles.amenityItem}>
                          {AmenIcon ? <AmenIcon size={18} color={colors.accent} /> : null}
                          <Text style={styles.amenityLabel}>{a}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Contact */}
              {trip.hotelPhone ? (
                <View style={styles.contactSection}>
                  <Text style={styles.subheader}>Contact</Text>
                  <Pressable
                    style={styles.phoneRow}
                    onPress={() => Linking.openURL(`tel:${trip.hotelPhone?.replace(/[^+\d]/g, '')}`)}
                  >
                    <Phone size={16} color={colors.accent} />
                    <Text style={styles.phoneText}>{trip.hotelPhone}</Text>
                  </Pressable>
                </View>
              ) : null}

              {trip.hotelUrl ? (
                <Pressable
                  style={({ pressed }) => [styles.hotelLinkBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => WebBrowser.openBrowserAsync(trip.hotelUrl!)}
                >
                  <Text style={styles.hotelLinkText}>View Hotel Website</Text>
                  <ExternalLink size={14} color={colors.accent} />
                </Pressable>
              ) : null}
            </Card>

            {trip.bookingRef ? (
              <View style={styles.refCard}>
                <Text style={styles.refLabel}>BOOKING REF</Text>
                <Text style={styles.refValue}>{trip.bookingRef}</Text>
              </View>
            ) : null}
          </>
        )}

        {activeTab === 'Nearby' && (
          <>
            {/* Mini map */}
            <MapView
              provider="google"
              style={styles.essentialsMap}
              initialRegion={{
                latitude: HOTEL_COORDS.lat,
                longitude: HOTEL_COORDS.lng,
                latitudeDelta: 0.025,
                longitudeDelta: 0.025,
              }}
            >
              <Marker
                coordinate={{ latitude: HOTEL_COORDS.lat, longitude: HOTEL_COORDS.lng }}
                title="Canyon Hotels"
                pinColor={colors.accent}
              />
              {NEARBY_ESSENTIALS.map((e) => (
                <Marker
                  key={e.name}
                  coordinate={{ latitude: e.lat, longitude: e.lng }}
                  title={e.name}
                  description={e.distance}
                />
              ))}
            </MapView>

            <Text style={styles.nearbyHeader}>Essential Locations</Text>
            {essentials.length === 0 ? (
              <Card>
                <Text style={styles.muted}>
                  No essentials saved yet. Add ATM, pharmacy, clinic, grocery from Discover.
                </Text>
              </Card>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {essentials.map(p => {
                  const mapsUrl =
                    p.latitude != null && p.longitude != null
                      ? `https://www.google.com/maps/dir/?api=1&origin=${trip.address ? encodeURIComponent(trip.address) : `${HOTEL_COORDS.lat},${HOTEL_COORDS.lng}`}&destination=${p.latitude},${p.longitude}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ' ' + (trip.destination || 'Boracay'))}`;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => Linking.openURL(mapsUrl)}
                      accessibilityRole="link"
                    >
                      <View style={styles.essRow}>
                        <MapPin size={16} color={colors.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.essName}>{p.name}</Text>
                          {p.distance ? (
                            <Text style={styles.essDistance}>{p.distance}</Text>
                          ) : null}
                        </View>
                        <ExternalLink size={16} color={colors.text3} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Static nearby list */}
            <Text style={[styles.nearbyHeader, { marginTop: spacing.lg }]}>Around the Hotel</Text>
            <View style={{ gap: spacing.sm }}>
              {NEARBY_ESSENTIALS.map(e => (
                <View key={e.name} style={styles.essRow}>
                  <MapPin size={16} color={colors.text3} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.essName}>{e.name}</Text>
                  </View>
                  <Text style={styles.essDistance}>{e.distance}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === 'Notes' && (
          <>
            <View style={styles.notesHeaderRow}>
              <Text style={styles.notesTitle}>Shared Notes</Text>
              {!editingNotes ? (
                <Pressable
                  onPress={() => {
                    setDraftNotes(trip.notes || DEFAULT_NOTES_TEMPLATE);
                    setEditingNotes(true);
                  }}
                  hitSlop={8}
                >
                  <Edit3 size={18} color={colors.text3} />
                </Pressable>
              ) : null}
            </View>

            <Card>
              {editingNotes ? (
                <View style={styles.notesEditContainer}>
                  <TextInput
                    style={styles.notesInput}
                    value={draftNotes}
                    onChangeText={setDraftNotes}
                    multiline
                    autoFocus
                    placeholderTextColor={colors.text3}
                    placeholder="Add notes..."
                  />
                  <View style={styles.notesActions}>
                    <Pressable
                      style={[styles.notesBtn, styles.notesCancelBtn]}
                      onPress={() => setEditingNotes(false)}
                      disabled={savingNotes}
                    >
                      <Text style={styles.notesCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.notesBtn, styles.notesSaveBtn]}
                      onPress={async () => {
                        setSavingNotes(true);
                        try {
                          await updateTripProperty(trip.id, 'Notes', draftNotes);
                          setTrip({ ...trip, notes: draftNotes });
                          setEditingNotes(false);
                        } catch {
                          // keep editing open
                        } finally {
                          setSavingNotes(false);
                        }
                      }}
                      disabled={savingNotes}
                    >
                      {savingNotes ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.notesSaveText}>Save</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : trip.notes ? (
                <Text style={styles.notes}>{sanitizeText(trip.notes)}</Text>
              ) : (
                <Text style={styles.muted}>No notes yet. Tap the pencil to add some.</Text>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    errorText: { color: colors.danger, fontSize: 13 },
    headerSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    pageTitle: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    pageSub: { color: colors.text2, fontSize: 13, marginTop: 2 },
    segmented: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.bg3,
      borderRadius: radius.md,
      padding: 3,
    },
    segBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: radius.sm,
    },
    segBtnActive: {
      backgroundColor: colors.card,
    },
    segText: {
      color: colors.text3,
      fontSize: 13,
      fontWeight: '600',
    },
    segTextActive: {
      color: colors.accentLt,
    },
    content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.lg },
    propName: { color: colors.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
    hotelAddressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    hotelAddress: { color: colors.text2, fontSize: 13, flex: 1 },
    timesGrid: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    timeBlock: {
      flex: 1,
      backgroundColor: colors.bg3,
      borderRadius: radius.sm,
      padding: spacing.md,
    },
    timeLabel: {
      color: colors.text3,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
    },
    timeValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      marginTop: 4,
    },
    amenities: { marginTop: spacing.lg },
    subheader: { color: colors.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.md },
    amenityGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    amenityItem: {
      width: '30%',
      alignItems: 'center',
      gap: 6,
      paddingVertical: spacing.md,
      backgroundColor: colors.bg3,
      borderRadius: radius.sm,
    },
    amenityLabel: {
      color: colors.text2,
      fontSize: 11,
      fontWeight: '600',
    },
    contactSection: { marginTop: spacing.lg },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    phoneText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
    hotelLinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.accentDim,
      borderRadius: radius.md,
      alignSelf: 'flex-start',
    },
    hotelLinkText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
    refCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    refLabel: { color: colors.text3, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    refValue: { color: colors.text, fontSize: 14, fontWeight: '600', fontFamily: 'SpaceMono' },
    essentialsMap: { height: 200, borderRadius: radius.lg, overflow: 'hidden' },
    nearbyHeader: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    essRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    essName: { color: colors.text, fontSize: 14, fontWeight: '600' },
    essDistance: { color: colors.text2, fontSize: 12, marginTop: 2 },
    muted: { color: colors.text2, fontSize: 13, lineHeight: 18 },
    // Notes
    notesHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    notesTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    notes: { color: colors.text, fontSize: 13, lineHeight: 20 },
    notesEditContainer: { gap: spacing.md },
    notesInput: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 20,
      minHeight: 80,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border2,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: colors.bg3,
    },
    notesActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
    notesBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 72,
    },
    notesCancelBtn: { backgroundColor: colors.bg3 },
    notesSaveBtn: { backgroundColor: colors.accent },
    notesCancelText: { color: colors.text2, fontSize: 13, fontWeight: '600' },
    notesSaveText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  });
