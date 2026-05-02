import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, CheckCircle, ChevronDown, Circle, EyeOff, MapPin, Calendar, Plane, Hotel, Users, Map, Wallet } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import type { Trip, Flight, GroupMember, Place } from '@/lib/types';
import { inferFlightLeg } from '@/lib/tripState';
import { cacheGet, cacheSet } from '@/lib/cache';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface ReadinessItem {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  icon: typeof MapPin;
}

interface TripReadinessCardProps {
  trip: Trip;
  flights: Flight[];
  members: GroupMember[];
  savedPlaces: Place[];
  onAction: (key: string) => void;
  onScanBooking?: () => void;
}

function getReadinessItems(
  trip: Trip,
  flights: Flight[],
  members: GroupMember[],
	savedPlaces: Place[],
): ReadinessItem[] {
  const legs = flights.map((flight) => inferFlightLeg(flight, flights));
  const hasOutbound = legs.includes('outbound');
  const hasReturn = legs.includes('return');
  const hasRoundTrip = flights.length >= 2 && hasOutbound && hasReturn;
  return [
    {
      key: 'destination',
      label: 'Destination',
      detail: trip.destination ?? 'Not set',
      done: !!trip.destination,
      icon: MapPin,
    },
    {
      key: 'dates',
      label: 'Travel dates',
      detail: trip.startDate && trip.endDate ? `${trip.nights ?? '?'} nights` : 'Not set',
      done: !!(trip.startDate && trip.endDate),
      icon: Calendar,
    },
    {
      key: 'flights',
      label: 'Round-trip flights',
	      detail: hasRoundTrip
	        ? 'Outbound and return added'
	        : flights.length > 0
	          ? `${flights.length} flight${flights.length > 1 ? 's' : ''} added, return leg missing`
	          : 'No flights yet',
      done: hasRoundTrip,
      icon: Plane,
    },
    {
      key: 'accommodation',
      label: 'Accommodation',
      detail: trip.accommodation ?? 'Not added yet',
      done: !!(trip.accommodation || trip.address),
      icon: Hotel,
    },
    {
      key: 'members',
      label: 'Travel group',
      detail: members.length > 1 ? `${members.length} members` : 'Just you',
      done: members.length > 1,
      icon: Users,
    },
    {
      key: 'places',
      label: 'Places to visit',
      detail: savedPlaces.length > 0 ? `${savedPlaces.length} saved` : 'Discover places',
      done: savedPlaces.length > 0,
      icon: Map,
    },
    {
      key: 'budget',
      label: 'Budget',
      detail: trip.budgetLimit ? `${trip.budgetMode} · limit set` : 'Not set',
      done: !!(trip.budgetLimit && trip.budgetLimit > 0),
      icon: Wallet,
    },
  ];
}

export function TripReadinessCard({ trip, flights, members, savedPlaces, onAction, onScanBooking }: TripReadinessCardProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  const items = useMemo(
    () => getReadinessItems(trip, flights, members, savedPlaces),
    [trip, flights, members, savedPlaces],
  );

  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = Math.round((doneCount / total) * 100);
  const allDone = doneCount === total;
  const hasAccommodation = !!items.find((i) => i.key === 'accommodation')?.done;
  const hasFlights = !!items.find((i) => i.key === 'flights')?.done;
  const defaultExpanded = !hasAccommodation || !hasFlights || doneCount < 5;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hidden, setHidden] = useState(false);
  const hiddenKey = `trip:readiness:hidden:${trip.id}`;
  const collapsedKey = `trip:readiness:collapsed:${trip.id}`;
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)),
    [items],
  );

  useEffect(() => {
    let cancelled = false;
    setExpanded(defaultExpanded);
    setHidden(false);

    Promise.all([
      cacheGet<boolean>(hiddenKey, 0),
      cacheGet<boolean>(collapsedKey, 0),
    ]).then(([storedHidden, storedCollapsed]) => {
      if (cancelled) return;
      setHidden(storedHidden === true);
      setExpanded(typeof storedCollapsed === 'boolean' ? !storedCollapsed : defaultExpanded);
    });

    return () => {
      cancelled = true;
    };
  }, [collapsedKey, defaultExpanded, hiddenKey]);

  const toggleExpanded = useCallback(() => {
    setExpanded((current) => {
      const next = !current;
      cacheSet(collapsedKey, !next).catch(() => {});
      return next;
    });
  }, [collapsedKey]);

  const hideChecklist = useCallback(() => {
    setHidden(true);
    cacheSet(hiddenKey, true).catch(() => {});
  }, [hiddenKey]);

  const showChecklist = useCallback(() => {
    setHidden(false);
    cacheSet(hiddenKey, false).catch(() => {});
  }, [hiddenKey]);

  if (hidden) {
    return (
      <View style={s.hiddenCard}>
        <Text style={s.hiddenText}>Trip checklist hidden</Text>
        <TouchableOpacity
          onPress={showChecklist}
          style={s.showBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Show trip readiness checklist"
        >
          <Text style={s.showText}>Show</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.card}>
      {/* Header */}
      <TouchableOpacity
        style={s.header}
        onPress={toggleExpanded}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse trip readiness checklist' : 'Expand trip readiness checklist'}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TRIP READINESS</Text>
          <Text style={s.title}>{allDone ? 'Trip is ready' : `${doneCount} of ${total} complete`}</Text>
          <Text style={s.subtitle}>
            {allDone ? 'Everything essential is filled in.' : 'Check what is still missing before you go.'}
          </Text>
        </View>
        <View style={s.pctBadge}>
          <Text style={s.pctText}>{pct}%</Text>
        </View>
        <ChevronDown
          size={18}
          color={colors.text3}
          strokeWidth={2}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {/* Progress bar */}
      <View style={[s.progressTrack, !expanded && { marginBottom: 0 }]}>
        <View style={[s.progressFill, { width: `${pct}%` }]} />
      </View>

      {/* Items — show incomplete first, then complete */}
      {expanded && (
        <>
          <View style={s.items}>
            {sortedItems.map((item) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={s.row}
                  onPress={() => onAction(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={[s.iconWrap, { backgroundColor: item.done ? colors.accentBg : colors.card2, borderColor: item.done ? colors.accentBorder : colors.border }]}>
                    <Icon size={14} color={item.done ? colors.accent : colors.text3} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowLabel, item.done && { color: colors.text2 }]}>{item.label}</Text>
                    <Text style={[s.rowDetail, item.done && { color: colors.text3 }]}>{item.detail}</Text>
                  </View>
                  {item.done ? (
                    <CheckCircle size={18} color={colors.accent} strokeWidth={2} />
                  ) : (
                    <Circle size={18} color={colors.border} strokeWidth={1.5} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Scan shortcut when accommodation or flights missing */}
          {onScanBooking && (!hasAccommodation || !hasFlights) && (
            <TouchableOpacity style={s.scanBtn} onPress={onScanBooking} activeOpacity={0.7}>
              <Camera size={15} color={colors.accent} strokeWidth={2} />
              <Text style={s.scanBtnText}>Scan a booking to auto-fill</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.hideBtn}
            onPress={hideChecklist}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Skip and hide trip readiness checklist"
          >
            <EyeOff size={13} color={colors.text3} strokeWidth={2} />
            <Text style={s.hideText}>Skip checklist</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 12,
  },
  hiddenCard: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hiddenText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.text3,
  },
  showBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: c.accentBg,
    borderWidth: 1,
    borderColor: c.accentBorder,
  },
  showText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.accent,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: c.text3,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    color: c.text3,
    marginTop: 4,
    lineHeight: 17,
  },
  pctBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: c.accentBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.accentBorder,
  },
  pctText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.accent,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.card2,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: c.accent,
  },
  items: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: c.text,
  },
  rowDetail: {
    fontSize: 11,
    color: c.text2,
    marginTop: 1,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.accentBorder,
    backgroundColor: c.accentBg,
  },
  scanBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.accent,
  },
  hideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  hideText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.text3,
  },
});
