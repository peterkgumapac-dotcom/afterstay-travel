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

import CalendarSync from '@/components/CalendarSync';
import Card from '@/components/Card';
import Pill from '@/components/Pill';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { getActiveTrip, getFlights, getSavedPlaces, updateTripProperty } from '@/lib/notion';
import type { Flight, Place, Trip } from '@/lib/types';
import { HOTEL_COORDS, NEARBY_ESSENTIALS } from '@/lib/boracayData';
import { ARRIVAL_TIMELINE, DEPARTURE_TIMELINE, FLIGHTS } from '@/lib/flightData';
import { sanitizeText } from '@/lib/sanitize';
import { flightDuration, formatTime, safeParse } from '@/lib/utils';

// ---------- time parsing helpers ----------

/** Parse a simple time string like "40 min", "1h 30m", "90 minutes" into total minutes.
 *  Returns null if unparseable. */
function parseMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // "90" — plain number, treat as minutes
  const plainNum = /^(\d+)$/.exec(trimmed);
  if (plainNum) return parseInt(plainNum[1], 10);

  // "1h 30m" or "1h30m" or "2h"
  const hm = /^(\d+)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/i.exec(trimmed);
  if (hm) return parseInt(hm[1], 10) * 60 + (hm[2] ? parseInt(hm[2], 10) : 0);

  // "40 min" or "40 minutes" or "40m"
  const mOnly = /^(\d+)\s*m(?:in(?:ute)?s?)?$/i.exec(trimmed);
  if (mOnly) return parseInt(mOnly[1], 10);

  return null;
}

function addMinutesToIso(iso: string, minutes: number): string {
  const d = new Date(safeParse(iso).getTime() + minutes * 60000);
  return d.toISOString();
}

function subtractMinutesFromIso(iso: string, minutes: number): string {
  const d = new Date(safeParse(iso).getTime() - minutes * 60000);
  return d.toISOString();
}

// ---------- screen ----------

export default function GuideScreen() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
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
        <ActivityIndicator color={colors.green2} />
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

  const outbound = flights.find(f => f.direction === 'Outbound');
  const returnFlight = flights.find(f => f.direction === 'Return');
  const essentials = places.filter(p => p.category === 'Essentials');

  const travelMin = parseMinutes(trip.airportToHotelTime);
  const bufferMin = parseMinutes(trip.airportArrivalBuffer);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.green2}
          />
        }
      >
        {/* Hotel Information */}
        {trip.hotelUrl ? (
          <Section
            icon={<Building2 size={16} color={colors.green2} />}
            title="Hotel Information"
          >
            <Card>
              <Text style={styles.propName}>{trip.accommodation}</Text>
              {trip.address ? (
                <View style={styles.hotelAddressRow}>
                  <MapPin size={14} color={colors.text2} />
                  <Text style={styles.hotelAddress}>{trip.address}</Text>
                </View>
              ) : null}
              <Pressable
                style={({ pressed }) => [
                  styles.hotelLinkBtn,
                  pressed ? styles.hotelLinkBtnPressed : null,
                ]}
                onPress={() => WebBrowser.openBrowserAsync(trip.hotelUrl!)}
              >
                <Text style={styles.hotelLinkText}>View Hotel Website</Text>
                <ExternalLink size={14} color={colors.green2} />
              </Pressable>
            </Card>
          </Section>
        ) : null}

        {/* Getting There */}
        <Section
          icon={<Plane size={16} color={colors.green2} />}
          title="Getting There"
        >
          <Card>
            {outbound ? (
              <>
                {/* ARRIVAL timeline */}
                {(() => {
                  const arrivalSteps = buildArrivalSteps();
                  return (
                    <View style={styles.timeline}>
                      {arrivalSteps.map((step, i) => (
                        <TimelineStep
                          key={i}
                          label={step.label}
                          time={step.time}
                          isFirst={i === 0}
                          isLast={i === arrivalSteps.length - 1}
                          isTransit={step.isTransit}
                        />
                      ))}
                    </View>
                  );
                })()}

                {/* DEPARTURE */}
                {returnFlight ? (
                  <>
                    <View style={styles.timelineDivider} />
                    <View style={styles.departureHeader}>
                      <Text style={styles.departureHeaderText}>DEPARTURE</Text>
                    </View>
                    {(() => {
                      const departureSteps = buildDepartureSteps();
                      return (
                        <View style={styles.timeline}>
                          {departureSteps.map((step, i) => (
                            <TimelineStep
                              key={i}
                              label={step.label}
                              time={step.time}
                              isFirst={i === 0}
                              isLast={i === departureSteps.length - 1}
                              isTransit={step.isTransit}
                            />
                          ))}
                        </View>
                      );
                    })()}
                  </>
                ) : null}
              </>
            ) : (
              <Text style={styles.muted}>No outbound flight saved yet.</Text>
            )}
          </Card>
          <CalendarSync trip={trip} flights={flights} />
        </Section>

        {/* Property Info */}
        <Section
          icon={<Sparkles size={16} color={colors.green2} />}
          title="Property"
        >
          <Card>
            <Text style={styles.propName}>{trip.accommodation}</Text>
            {trip.locationRating ? (
              <View style={{ marginTop: 4 }}>
                <Pill label={`Location ${trip.locationRating}`} tone="green" />
              </View>
            ) : null}

            <InfoRow
              icon={<MapPin size={14} color={colors.text2} />}
              label="Address"
              value={trip.address}
            />
            {trip.hotelPhone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${trip.hotelPhone?.replace(/[^+\d]/g, '')}`)}>
                <InfoRow
                  icon={<Phone size={14} color={colors.green2} />}
                  label="Phone"
                  value={trip.hotelPhone}
                  link
                />
              </Pressable>
            ) : null}
            {trip.bookingRef ? (
              <InfoRow label="Booking Ref" value={trip.bookingRef} mono />
            ) : null}
            {trip.roomType ? (
              <InfoRow label="Room" value={trip.roomType} />
            ) : null}

            {trip.amenities && trip.amenities.length > 0 ? (
              <View style={styles.amenities}>
                <Text style={styles.subheader}>Amenities</Text>
                <View style={styles.amenityRow}>
                  {trip.amenities.map(a => (
                    <Pill key={a} label={a} />
                  ))}
                </View>
              </View>
            ) : null}
          </Card>
        </Section>


        {/* Nearby Essentials */}
        <Section
          icon={<ShieldCheck size={16} color={colors.green2} />}
          title="Nearby Essentials"
        >
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
              pinColor={colors.green}
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
                    accessibilityLabel={`Get directions to ${p.name}`}
                  >
                    <Card padded={false}>
                      <View style={styles.essRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.essName}>{p.name}</Text>
                          {p.distance ? (
                            <Text style={styles.essDistance}>{p.distance}</Text>
                          ) : null}
                        </View>
                        <ExternalLink size={16} color={colors.green2} />
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Section>

        {/* Notes */}
        <Section
          title="Notes"
          right={
            !editingNotes ? (
              <Pressable
                onPress={() => {
                  setDraftNotes(trip.notes || DEFAULT_NOTES_TEMPLATE);
                  setEditingNotes(true);
                }}
                hitSlop={8}
              >
                <Edit3 size={16} color={colors.text3} />
              </Pressable>
            ) : null
          }
        >
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
                        // keep editing open so the user can retry
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
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  icon,
  title,
  right,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
        {right ? <View style={{ marginLeft: 'auto' }}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

// ---------- Timeline helpers ----------

type TimelineItem = { label: string; time?: string; isTransit?: boolean };

/** Parse airportToHotelTime into intermediate travel steps.
 *  Handles structured strings like "Boat from X to Y (~15-20 min) + trike/van to Z (~10 min)" */
function parseTransitSteps(raw: string | undefined): { label: string; duration: string }[] {
  if (!raw) return [];
  // Split on "+" or "then" to detect multiple legs
  const legs = raw.split(/\s*\+\s*|\s+then\s+/i).map(s => s.trim()).filter(Boolean);
  if (legs.length <= 1) return [];
  return legs.map(leg => {
    const durationMatch = /\(([^)]+)\)/.exec(leg);
    const duration = durationMatch ? durationMatch[1].trim() : '';
    const label = leg.replace(/\([^)]*\)/g, '').trim();
    return { label, duration };
  });
}

function buildArrivalSteps(): TimelineItem[] {
  return [
    { label: ARRIVAL_TIMELINE.flight.label, time: ARRIVAL_TIMELINE.flight.time },
    { label: ARRIVAL_TIMELINE.land.label, time: ARRIVAL_TIMELINE.land.time },
    { label: ARRIVAL_TIMELINE.trikeToJetty.note, isTransit: true },
    { label: ARRIVAL_TIMELINE.boat.note, isTransit: true },
    { label: ARRIVAL_TIMELINE.trike.note, isTransit: true },
    { label: ARRIVAL_TIMELINE.arriveHotel.label, time: `~${ARRIVAL_TIMELINE.arriveHotel.time}` },
  ];
}

function buildDepartureSteps(): TimelineItem[] {
  return [
    { label: DEPARTURE_TIMELINE.checkOutHotel.label, time: DEPARTURE_TIMELINE.checkOutHotel.time },
    { label: DEPARTURE_TIMELINE.trike.note, isTransit: true },
    { label: DEPARTURE_TIMELINE.boat.note, isTransit: true },
    { label: DEPARTURE_TIMELINE.trikeToAirport.note, isTransit: true },
    { label: DEPARTURE_TIMELINE.arriveAirport.label, time: DEPARTURE_TIMELINE.arriveAirport.time },
    { label: DEPARTURE_TIMELINE.flight.label, time: DEPARTURE_TIMELINE.flight.time },
  ];
}

function TimelineStep({
  label,
  time,
  isFirst,
  isLast,
  isTransit,
}: {
  label: string;
  time?: string;
  isFirst?: boolean;
  isLast?: boolean;
  isTransit?: boolean;
}) {
  const dotColor = isFirst || isLast ? colors.green2 : colors.text3;
  const dotSize = isLast ? 14 : 10;
  const dotBorderWidth = isLast ? 3 : 0;

  return (
    <View style={styles.timelineStepRow}>
      {/* Dot column */}
      <View style={styles.timelineDotCol}>
        {!isFirst && !isTransit ? <View style={styles.timelineLineAbove} /> : null}
        {isTransit ? (
          <View style={styles.timelineTransitCol}>
            <View style={styles.timelineLineAbove} />
            <Text style={styles.timelineArrow}>↓</Text>
            <View style={styles.timelineLineBelow} />
          </View>
        ) : (
          <View
            style={[
              styles.timelineDot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: isLast ? 'transparent' : dotColor,
                borderWidth: dotBorderWidth,
                borderColor: dotColor,
              },
            ]}
          />
        )}
        {!isLast && !isTransit ? <View style={styles.timelineLineBelow} /> : null}
      </View>

      {/* Text column */}
      <View style={styles.timelineTextCol}>
        {isTransit ? (
          <Text style={styles.timelineTransitText}>{label}</Text>
        ) : (
          <View style={styles.timelineLabelRow}>
            <Text style={[styles.timelineLabel, (isFirst || isLast) ? styles.timelineLabelBold : null]}>
              {label}
            </Text>
            {time ? <Text style={styles.timelineTime}>{time}</Text> : null}
          </View>
        )}
      </View>
    </View>
  );
}

function TimeRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.timeRow}>
      <Text style={[styles.timeLabel, highlight ? styles.timeLabelHighlight : null]}>
        {label}
      </Text>
      <Text style={[styles.timeValue, highlight ? styles.timeValueHighlight : null]}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function InfoRow({
  icon,
  label,
  value,
  mono,
  link,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  link?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      {icon ? <View style={{ marginTop: 2 }}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text
          style={[
            styles.infoValue,
            mono ? { fontFamily: 'SpaceMono', fontSize: 13 } : null,
            link ? { color: colors.green2 } : null,
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.red, fontSize: 13 },
  content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.7 },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.green + '22',
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: colors.green2, fontWeight: '700', fontSize: 12 },
  stepTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  stepBody: { color: colors.text2, fontSize: 12, marginTop: 2, lineHeight: 17 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md, marginLeft: 40 },
  propName: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  infoRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  infoLabel: { color: colors.text3, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  infoValue: { color: colors.text, fontSize: 14, marginTop: 2 },
  amenities: { marginTop: spacing.lg },
  subheader: { color: colors.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.sm },
  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  essentialsMap: { height: 200, borderRadius: radius.lg, overflow: 'hidden' },
  essRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  essName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  essDistance: { color: colors.text2, fontSize: 12, marginTop: 2 },
  muted: { color: colors.text2, fontSize: 13, lineHeight: 18 },
  notes: { color: colors.text, fontSize: 13, lineHeight: 20 },
  // Hotel Information card
  hotelAddressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  hotelAddress: { color: colors.text2, fontSize: 13, flex: 1 },
  hotelLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.green + '18',
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  hotelLinkBtnPressed: { opacity: 0.7 },
  hotelLinkText: { color: colors.green2, fontSize: 14, fontWeight: '600' },
  // Time breakdown rows
  timeBreakdown: {
    marginTop: spacing.sm,
    marginLeft: 38,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg3,
    borderRadius: radius.md,
    gap: 4,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeLabel: { color: colors.text2, fontSize: 12 },
  timeValue: { color: colors.text, fontSize: 12, fontWeight: '600' },
  timeLabelHighlight: { color: colors.green2, fontWeight: '600' },
  timeValueHighlight: { color: colors.green2, fontWeight: '700', fontSize: 13 },
  // Departure header
  departureHeader: { marginBottom: spacing.xs },
  departureHeaderText: { color: colors.amber, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  // Notes editing
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
  notesSaveBtn: { backgroundColor: colors.green },
  notesCancelText: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  notesSaveText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  // Timeline
  timeline: { gap: 0 },
  timelineStepRow: { flexDirection: 'row', minHeight: 32 },
  timelineDotCol: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDot: { zIndex: 1 },
  timelineLineAbove: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border2,
  },
  timelineLineBelow: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border2,
  },
  timelineTransitCol: {
    flex: 1,
    alignItems: 'center',
  },
  timelineArrow: { color: colors.text3, fontSize: 12, lineHeight: 14 },
  timelineTextCol: { flex: 1, justifyContent: 'center', paddingVertical: spacing.sm },
  timelineLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timelineLabel: { color: colors.text2, fontSize: 13, flexShrink: 1 },
  timelineLabelBold: { color: colors.text, fontWeight: '600' },
  timelineTime: { color: colors.green2, fontSize: 12, fontWeight: '600' },
  timelineTransitText: { color: colors.text3, fontSize: 12, fontStyle: 'italic' },
  timelineDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
});
