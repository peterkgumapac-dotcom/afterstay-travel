import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CalendarPlus, Hotel, MessageCircle, Plane, UserPlus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
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
  onMemberProfile: (m: GroupMember) => void;
  onInvite: () => void;
  onAddMember: () => void;
  onCalendarInvite: () => void;
  isPrimary?: boolean;
  currentUserId?: string;
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
  onMemberProfile,
  onInvite,
  onAddMember,
  onCalendarInvite,
  isPrimary = false,
  currentUserId,
}: OverviewTabProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const hasAccom = !!(trip?.accommodation || trip?.address);
  const currentMember = members.find((member) => member.userId === currentUserId);
  const primaryMember = members.find((member) => member.role === 'Primary');
  const isSharingOrganizerStay = currentMember?.sharesAccommodation === true;
  const showSharedStayPending = !hasAccom && !isPrimary && isSharingOrganizerStay;
  const hasMemberSetup = (member: GroupMember) => member.sharesAccommodation !== undefined || !!member.travelNotes?.trim();

  return (
    <>
      {/* Group */}
      <GroupHeader
        kicker={`Group · ${members.length} traveler${members.length !== 1 ? 's' : ''}`}
        title="Who's going"
        action={isPrimary ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={onAddMember} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <UserPlus size={12} color={colors.accent} strokeWidth={2} />
              <Text style={styles.ghostAction}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onInvite}>
              <Text style={styles.ghostAction}>Invite +</Text>
            </TouchableOpacity>
          </View>
        ) : undefined}
        colors={colors}
      />
      <View style={styles.listContainer}>
        {members.map((m, idx) => (
          <TouchableOpacity
            key={m.id}
            style={styles.memberRow}
            activeOpacity={0.7}
            onPress={() => {
              if (m.userId && m.userId !== currentUserId && !isPrimary) {
                onMemberProfile(m);
                return;
              }
              onMemberEdit(m);
            }}
            accessibilityRole="button"
            accessibilityLabel={isPrimary || m.userId === currentUserId ? `Edit ${m.name} contact details` : `View ${m.name} profile`}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => m.userId ? onMemberProfile(m) : onMemberEdit(m)}
              accessibilityLabel={m.userId ? `View ${m.name} profile` : `Edit ${m.name}`}
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
            </TouchableOpacity>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {m.name}
                {m.userId === currentUserId ? (
                  <Text style={styles.youBadge}> YOU</Text>
                ) : m.role === 'Primary' ? (
                  <Text style={styles.youBadge}> ORGANIZER</Text>
                ) : null}
              </Text>
              <Text style={styles.memberRole}>
                {m.role === 'Primary' ? 'Organizer' : 'Member'} · {
                  m.userId
                    ? '● On the app'
                    : m.email || m.phone
                      ? '○ Added manually'
                      : '○ Added manually'
                }
              </Text>
              {hasMemberSetup(m) ? (
                <View style={styles.memberSetupRow}>
                  {m.sharesAccommodation !== undefined ? (
                    <View style={styles.memberSetupChip}>
                      <Hotel size={10} color={colors.accent} strokeWidth={2} />
                      <Text style={styles.memberSetupText}>
                        {m.sharesAccommodation ? 'Same stay' : 'Own stay'}
                      </Text>
                    </View>
                  ) : null}
                  {m.travelNotes ? (
                    <View style={styles.memberSetupChip}>
                      <Plane size={10} color={colors.accent} strokeWidth={2} />
                      <Text style={styles.memberSetupText} numberOfLines={1}>
                        {m.travelNotes}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
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
        <TouchableOpacity
          style={styles.calendarBtn}
          onPress={onCalendarInvite}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open trip in Google Calendar"
        >
          <CalendarPlus size={14} color={colors.accent} strokeWidth={2} />
          <Text style={styles.calendarBtnText}>
            {members.some((m) => m.email) ? 'Send Calendar Invite to All' : 'Add Trip to Google Calendar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Accommodation */}
      {hasAccom ? (
        <>
          <GroupHeader
            kicker="Accommodation"
            title={trip?.accommodation ?? 'Hotel'}
            action={
              trip?.cost != null ? (
                <View style={styles.paidChip}>
                  <Text style={styles.paidChipText}>Paid</Text>
                </View>
              ) : undefined
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
                  <View style={[styles.accomThumb, { backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' }]}>
                    <Hotel size={20} color={colors.text3} />
                  </View>
                )}
                <View style={styles.accomHeaderInfo}>
                  <Text style={styles.accomTitle}>
                    {trip?.roomType || trip?.accommodation || 'Accommodation'}
                  </Text>
                  {trip?.address ? <Text style={styles.accomAddr}>{trip.address}</Text> : null}
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
                    <Text style={styles.accomGridLabel}>SPLIT / PERSON</Text>
                    <Text style={styles.accomGridValue}>
                      {formatCurrency(trip.cost / members.length, trip.costCurrency || 'PHP')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </>
      ) : showSharedStayPending ? (
        <>
          <GroupHeader kicker="Accommodation" title="Shared stay pending" colors={colors} />
          <View style={styles.sectionPadding}>
            <View style={[styles.accomCard, styles.emptySharedCard]}>
              <Hotel size={28} color={colors.accent} strokeWidth={1.5} />
              <Text style={styles.emptySharedTitle}>Same stay selected</Text>
              <Text style={styles.emptySharedBody}>
                The organizer has not added the hotel yet. Once they upload or enter the booking, it will appear here for you too.
              </Text>
              {primaryMember ? (
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => onMemberChat(primaryMember)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${primaryMember.name}`}
                >
                  <MessageCircle size={14} color={colors.text} />
                  <Text style={styles.secondaryActionText}>Message organizer</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </>
      ) : (
        <>
          <GroupHeader kicker="Accommodation" title="Add your hotel" colors={colors} />
          <View style={styles.sectionPadding}>
            <View style={[styles.accomCard, { alignItems: 'center', paddingVertical: 24 }]}>
              <Hotel size={28} color={colors.text3} strokeWidth={1.5} />
              <Text style={{ color: colors.text2, fontSize: 14, fontWeight: '600', marginTop: 10 }}>
                Add your hotel details
              </Text>
              <Text style={{ color: colors.text3, fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                Upload your booking confirmation or enter the details manually.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={{ backgroundColor: colors.accent, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 }}
                  onPress={() => router.push({ pathname: '/scan-trip', params: { mode: 'hotel', tripId: trip?.id } } as never)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Upload booking</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: colors.card2, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                  onPress={() => router.push({ pathname: '/trip-overview', params: { tripId: trip?.id } } as never)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Enter manually</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Flights */}
      {flights.length > 0 ? (
        <>
          <GroupHeader kicker="Transit · Both ways" title="Flights" colors={colors} />
          <View style={styles.flightsList}>
            {flights.map((f, i) => (
              <MiniFlightCard key={f.ref || i} f={f} colors={colors} tripId={trip?.id} />
            ))}
          </View>
        </>
      ) : (
        <>
          <GroupHeader kicker="Transit" title="Add your flight" colors={colors} />
          <View style={styles.sectionPadding}>
            <View style={[styles.accomCard, { alignItems: 'center', paddingVertical: 24 }]}>
              <Plane size={28} color={colors.text3} strokeWidth={1.5} />
              <Text style={{ color: colors.text2, fontSize: 14, fontWeight: '600', marginTop: 10 }}>
                Add your flight
              </Text>
              <Text style={{ color: colors.text3, fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                Upload your boarding pass or enter flight details manually.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={{ backgroundColor: colors.accent, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 }}
                  onPress={() => router.push({ pathname: '/scan-trip', params: { mode: 'flight', tripId: trip?.id } } as never)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Upload boarding pass</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </>
      )}
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
    calendarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 14,
    },
    calendarBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
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
    memberSetupRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 7,
    },
    memberSetupChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: 190,
      paddingVertical: 4,
      paddingHorizontal: 7,
      borderRadius: 999,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    memberSetupText: {
      fontSize: 10,
      color: colors.accent,
      fontWeight: '700',
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
    emptySharedCard: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    emptySharedTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 10,
    },
    emptySharedBody: {
      color: colors.text3,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18,
    },
    secondaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: colors.card2,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 16,
    },
    secondaryActionText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
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
