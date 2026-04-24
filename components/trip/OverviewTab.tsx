import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import type { GroupMember, Trip } from '@/lib/types';
import { formatDatePHT, formatCurrency } from '@/lib/utils';
import { GroupHeader } from './GroupHeader';
import { MiniFlightCard } from './MiniFlightCard';
import type { FlightDisplayData, ThemeColors } from './tripConstants';
import { MEMBER_COLORS } from './tripConstants';

interface OverviewTabProps {
  trip: Trip | null;
  members: GroupMember[];
  flights: FlightDisplayData[];
  hotelPhotos: string[];
  colors: ThemeColors;
  onMemberEdit: (m: GroupMember) => void;
  onMemberChat: (m: GroupMember) => void;
  onInvite: () => void;
  onLoad: () => void;
}

export function OverviewTab({
  trip,
  members,
  flights,
  hotelPhotos,
  colors,
  onMemberEdit,
  onMemberChat,
  onInvite,
}: OverviewTabProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <>
      {/* Group */}
      <GroupHeader
        kicker={`Group · ${members.length} traveler${members.length !== 1 ? 's' : ''}`}
        title="Who's going"
        action={
          <TouchableOpacity onPress={onInvite}>
            <Text style={styles.ghostAction}>Invite +</Text>
          </TouchableOpacity>
        }
        colors={colors}
      />
      <View style={styles.listContainer}>
        {members.map((m, idx) => (
          <TouchableOpacity
            key={m.id}
            style={styles.memberRow}
            activeOpacity={0.7}
            onPress={() => onMemberEdit(m)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${m.name} contact details`}
          >
            {m.profilePhoto ? (
              <Image
                source={{ uri: m.profilePhoto }}
                style={styles.memberAvatar}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.memberAvatar,
                  { backgroundColor: MEMBER_COLORS[idx % MEMBER_COLORS.length] },
                ]}
              >
                <Text style={styles.memberInit}>{m.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {m.name}
                {m.role === 'Primary' && (
                  <Text style={styles.youBadge}> YOU</Text>
                )}
              </Text>
              <Text style={styles.memberRole}>
                {m.role} · {m.userId ? 'On the app' : 'Not yet joined'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.memberChatBtn}
              accessibilityLabel={`Message ${m.name}`}
              onPress={() => onMemberChat(m)}
            >
              <MessageCircle size={14} color={colors.text} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>

      {/* Accommodation */}
      <GroupHeader
        kicker="Accommodation"
        title={trip?.accommodation ?? 'Hotel'}
        action={
          <View style={styles.paidChip}>
            <Text style={styles.paidChipText}>Paid</Text>
          </View>
        }
        colors={colors}
      />
      <View style={styles.sectionPadding}>
        <View style={styles.accomCard}>
          <View style={styles.accomHeader}>
            {hotelPhotos[0] ? (
              <Image
                source={{ uri: hotelPhotos[0] }}
                style={styles.accomThumb}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.accomThumb} />
            )}
            <View style={styles.accomHeaderInfo}>
              <Text style={styles.accomTitle}>
                {trip?.roomType || trip?.accommodation || 'Room'}
              </Text>
              <Text style={styles.accomAddr}>
                {trip?.address || ''}
              </Text>
            </View>
          </View>
          <View style={styles.accomGrid}>
            <View>
              <Text style={styles.accomGridLabel}>CHECK-IN</Text>
              <Text style={styles.accomGridValue}>
                {trip ? formatDatePHT(trip.startDate) : ''} · {trip?.checkIn || '3:00 PM'}
              </Text>
            </View>
            <View>
              <Text style={styles.accomGridLabel}>CHECKOUT</Text>
              <Text style={styles.accomGridValue}>
                {trip ? formatDatePHT(trip.endDate) : ''} · {trip?.checkOut || '12:00 PM'}
              </Text>
            </View>
            {trip?.cost != null && (
              <View>
                <Text style={styles.accomGridLabel}>TOTAL</Text>
                <Text style={styles.accomGridValue}>
                  {formatCurrency(trip.cost, trip.costCurrency || 'PHP')}
                </Text>
              </View>
            )}
            {trip?.cost != null && members.length > 0 && (
              <View>
                <Text style={styles.accomGridLabel}>
                  SPLIT / PERSON
                </Text>
                <Text style={styles.accomGridValue}>
                  {formatCurrency(trip.cost / members.length, trip.costCurrency || 'PHP')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Mini flights */}
      <GroupHeader
        kicker="Transit · Both ways"
        title="Flights"
        colors={colors}
      />
      <View style={styles.flightsList}>
        {flights.map((f, i) => (
          <MiniFlightCard key={f.ref || i} f={f} colors={colors} />
        ))}
      </View>
    </>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ghostAction: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },
    listContainer: {
      paddingHorizontal: 16,
      gap: 8,
    },
    sectionPadding: {
      paddingHorizontal: 16,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    memberAvatar: {
      width: 38,
      height: 38,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberInit: {
      color: colors.bg,
      fontSize: 13,
      fontWeight: '600',
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    youBadge: {
      fontSize: 10,
      color: colors.accent,
      fontWeight: '600',
    },
    memberRole: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    memberChatBtn: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accomCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 18,
    },
    accomHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    accomThumb: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden' as const,
    },
    accomHeaderInfo: {
      flex: 1,
    },
    accomTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    accomAddr: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    accomGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    accomGridLabel: {
      color: colors.text3,
      fontSize: 10,
      letterSpacing: 0.8,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    accomGridValue: {
      color: colors.text,
      marginTop: 3,
      fontWeight: '600',
      fontSize: 12,
    },
    paidChip: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    paidChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
    },
    flightsList: {
      paddingHorizontal: 16,
      gap: 10,
    },
  });
