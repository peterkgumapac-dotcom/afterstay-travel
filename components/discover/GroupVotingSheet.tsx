import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native'
import {
  X,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Check,
  ChevronRight,
  Star,
  Users,
  UserPlus,
  PartyPopper,
  Swords,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '@/constants/ThemeContext'
import { voteAsMember, deriveConsensus } from '@/lib/supabase'
import RPSTiebreakerSheet from './RPSTiebreakerSheet'
import type { Place, PlaceVote, GroupMember } from '@/lib/types'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72

const MEMBER_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b']

// ── Props ───────────────────────────────────────────────────────────────

interface GroupVotingSheetProps {
  visible: boolean
  onClose: () => void
  place: Place | null
  /** All places needing votes — enables "Next place" navigation */
  pendingPlaces?: Place[]
  members: GroupMember[]
  currentMemberId: string
  onVoteUpdated?: (placeId: string, votes: Record<string, PlaceVote>) => void
}

// ── Helpers ─────────────────────────────────────────────────────────────

function voteSummaryText(
  votes: Record<string, PlaceVote>,
  total: number,
): string {
  const entries = Object.values(votes)
  const yes = entries.filter((v) => v === '👍 Yes').length
  const no = entries.filter((v) => v === '👎 No').length
  const voted = entries.length
  if (voted === 0) return 'No votes yet'
  const parts: string[] = []
  if (yes > 0) parts.push(`${yes} yes`)
  if (no > 0) parts.push(`${no} no`)
  const pending = total - voted
  if (pending > 0) parts.push(`${pending} pending`)
  return `${voted}/${total} voted · ${parts.join(', ')}`
}

function consensusLabel(consensus: PlaceVote): string {
  if (consensus === '👍 Yes') return 'Group says Yes'
  if (consensus === '👎 No') return 'Group says No'
  return 'Waiting for votes'
}

// ── Component ───────────────────────────────────────────────────────────

export default function GroupVotingSheet({
  visible,
  onClose,
  place: initialPlace,
  pendingPlaces,
  members,
  currentMemberId,
  onVoteUpdated,
}: GroupVotingSheetProps) {
  const { colors } = useTheme()
  const s = getStyles(colors)

  // Support navigating between pending places
  const [placeIdx, setPlaceIdx] = useState(0)
  const places = useMemo(
    () =>
      pendingPlaces && pendingPlaces.length > 0
        ? pendingPlaces
        : initialPlace
          ? [initialPlace]
          : [],
    [pendingPlaces, initialPlace],
  )
  const place = places[placeIdx] ?? initialPlace

  const [voting, setVoting] = useState(false)
  // Local optimistic votes state
  const [localVotes, setLocalVotes] = useState<Record<string, PlaceVote> | null>(null)

  // Reset state when sheet opens/place changes
  React.useEffect(() => {
    if (visible) {
      setPlaceIdx(0)
      setLocalVotes(null)
    }
  }, [visible])

  React.useEffect(() => {
    setLocalVotes(null)
  }, [place?.id])

  const votes = localVotes ?? place?.voteByMember ?? {}
  const totalMembers = members.length
  const consensus = deriveConsensus(votes, totalMembers)
  const myVote = votes[currentMemberId]

  // Tie detection: all members voted but no majority
  const allVoted = Object.keys(votes).length >= totalMembers
  const isTied = allVoted && consensus === 'Pending'

  // RPS tiebreaker state
  const [showRps, setShowRps] = useState(false)

  const handleRpsSettled = useCallback(
    (settledPlaceId: string, winnerVote: PlaceVote) => {
      // Update local state to reflect the winner's decision
      onVoteUpdated?.(settledPlaceId, votes)
      setTimeout(() => setShowRps(false), 1500)
    },
    [votes, onVoteUpdated],
  )

  const handleVote = useCallback(
    async (vote: PlaceVote) => {
      if (!place || voting) return
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      // Optimistic update
      const prev = { ...votes }
      const optimistic = { ...prev, [currentMemberId]: vote }
      setLocalVotes(optimistic)
      setVoting(true)

      try {
        const updated = await voteAsMember(
          place.id,
          currentMemberId,
          vote,
          totalMembers,
        )
        setLocalVotes(updated)
        onVoteUpdated?.(place.id, updated)
      } catch {
        // Revert on failure
        setLocalVotes(prev)
      } finally {
        setVoting(false)
      }
    },
    [place, votes, currentMemberId, totalMembers, voting, onVoteUpdated],
  )

  const goNext = useCallback(() => {
    if (placeIdx < places.length - 1) {
      setPlaceIdx((i) => i + 1)
    }
  }, [placeIdx, places.length])

  // Empty state: no places to vote on
  const showEmptyNoPlaces = !place && members.length >= 2
  // Empty state: solo traveler (< 2 members)
  const showEmptySolo = members.length < 2

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          {/* Drag handle */}
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title} numberOfLines={1}>
              Group Vote
            </Text>
            {places.length > 1 && (
              <Text style={s.counter}>
                {placeIdx + 1}/{places.length}
              </Text>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <X size={22} color={colors.text2} />
            </TouchableOpacity>
          </View>

          {/* Empty state: solo traveler */}
          {showEmptySolo ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIconWrap}>
                <UserPlus size={32} color={colors.accent} />
              </View>
              <Text style={s.emptyTitle}>Invite your travel group</Text>
              <Text style={s.emptyBody}>
                Group voting needs at least 2 members. Invite companions to vote on places together.
              </Text>
            </View>
          ) : showEmptyNoPlaces ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIconWrap}>
                <PartyPopper size={32} color={colors.accent} />
              </View>
              <Text style={s.emptyTitle}>All caught up!</Text>
              <Text style={s.emptyBody}>
                No places waiting for votes right now. Discover and recommend places to start a group vote.
              </Text>
            </View>
          ) : !place ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIconWrap}>
                <Users size={32} color={colors.text3} />
              </View>
              <Text style={s.emptyTitle}>No places to vote on</Text>
              <Text style={s.emptyBody}>
                Save and recommend places from the Discover tab to start group voting.
              </Text>
            </View>
          ) : (

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {/* Place card */}
            <View style={s.placeCard}>
              {place.photoUrl ? (
                <Image source={{ uri: place.photoUrl }} style={s.placePhoto} />
              ) : (
                <View style={[s.placePhoto, s.photoPlaceholder]}>
                  <Star size={24} color={colors.text3} />
                </View>
              )}
              <View style={s.placeInfo}>
                <Text style={s.placeName} numberOfLines={2}>
                  {place.name}
                </Text>
                <View style={s.placeMeta}>
                  <View style={s.categoryPill}>
                    <Text style={s.categoryText}>{place.category}</Text>
                  </View>
                  {place.rating != null && (
                    <View style={s.ratingChip}>
                      <Star size={12} color={colors.warn} fill={colors.warn} />
                      <Text style={s.ratingText}>{place.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Consensus */}
            <View style={s.consensusRow}>
              <Text style={s.consensusText}>{consensusLabel(consensus)}</Text>
              <Text style={s.summaryText}>
                {voteSummaryText(votes, totalMembers)}
              </Text>
            </View>

            {/* Member votes */}
            <View style={s.memberList}>
              {members.map((m, i) => {
                const memberVote = votes[m.id]
                return (
                  <View key={m.id} style={s.memberRow}>
                    {/* Avatar */}
                    {m.profilePhoto ? (
                      <Image
                        source={{ uri: m.profilePhoto }}
                        style={[
                          s.avatar,
                          { borderColor: MEMBER_COLORS[i % MEMBER_COLORS.length] },
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          s.avatar,
                          s.avatarFallback,
                          { backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] },
                        ]}
                      >
                        <Text style={s.avatarInitial}>
                          {m.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    {/* Name */}
                    <Text style={s.memberName} numberOfLines={1}>
                      {m.name}
                      {m.id === currentMemberId ? ' (you)' : ''}
                    </Text>

                    {/* Vote badge */}
                    {memberVote === '👍 Yes' ? (
                      <View style={[s.badge, s.badgeYes]}>
                        <Check size={14} color="#2d6a2e" />
                        <Text style={[s.badgeText, s.badgeYesText]}>Yes</Text>
                      </View>
                    ) : memberVote === '👎 No' ? (
                      <View style={[s.badge, s.badgeNo]}>
                        <X size={14} color="#9e3a34" />
                        <Text style={[s.badgeText, s.badgeNoText]}>No</Text>
                      </View>
                    ) : (
                      <View style={[s.badge, s.badgePending]}>
                        <Clock size={14} color={colors.text3} />
                        <Text style={[s.badgeText, s.badgePendingText]}>
                          Pending
                        </Text>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>

            {/* Action buttons */}
            <View style={s.actions}>
              <TouchableOpacity
                style={[
                  s.voteBtn,
                  s.voteBtnYes,
                  myVote === '👍 Yes' && s.voteBtnActive,
                ]}
                onPress={() => handleVote('👍 Yes')}
                disabled={voting}
                activeOpacity={0.7}
              >
                <ThumbsUp
                  size={20}
                  color={myVote === '👍 Yes' ? colors.canvas : colors.accent}
                />
                <Text
                  style={[
                    s.voteBtnText,
                    s.voteBtnYesText,
                    myVote === '👍 Yes' && s.voteBtnActiveText,
                  ]}
                >
                  {myVote === '👍 Yes' ? 'Voted Yes' : "I'm In"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.voteBtn,
                  s.voteBtnNo,
                  myVote === '👎 No' && s.voteBtnNoActive,
                ]}
                onPress={() => handleVote('👎 No')}
                disabled={voting}
                activeOpacity={0.7}
              >
                <ThumbsDown
                  size={20}
                  color={myVote === '👎 No' ? '#fff' : colors.text2}
                />
                <Text
                  style={[
                    s.voteBtnText,
                    s.voteBtnNoText,
                    myVote === '👎 No' && s.voteBtnNoActiveText,
                  ]}
                >
                  {myVote === '👎 No' ? 'Voted No' : 'Pass'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tiebreaker button — shown when all voted but tied */}
            {isTied && (
              <TouchableOpacity
                style={s.tiebreakerBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowRps(true)
                }}
                activeOpacity={0.7}
              >
                <Swords size={18} color={colors.accent} />
                <Text style={s.tiebreakerText}>Can't decide? Settle it!</Text>
              </TouchableOpacity>
            )}

            {/* Next place */}
            {places.length > 1 && placeIdx < places.length - 1 && (
              <TouchableOpacity style={s.nextBtn} onPress={goNext}>
                <Text style={s.nextBtnText}>Next place</Text>
                <ChevronRight size={18} color={colors.accent} />
              </TouchableOpacity>
            )}
          </ScrollView>
          )}

          {/* RPS Tiebreaker */}
          {place && (
            <RPSTiebreakerSheet
              visible={showRps}
              onClose={() => setShowRps(false)}
              placeId={place.id}
              placeName={place.name}
              members={members}
              currentMemberId={currentMemberId}
              memberVotes={votes}
              onSettled={handleRpsSettled}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────

const getStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: SHEET_HEIGHT,
      backgroundColor: colors.canvas,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
    },
    handleRow: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 4,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.text3,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    counter: {
      fontSize: 13,
      color: colors.text3,
      marginRight: 8,
    },
    closeBtn: {
      padding: 4,
    },

    // Empty states
    emptyWrap: {
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingVertical: 48,
      gap: 12,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accentDim,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    emptyBody: {
      fontSize: 13,
      color: colors.text2,
      textAlign: 'center',
      lineHeight: 19,
    },

    // Place card
    placeCard: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 8,
      padding: 12,
      backgroundColor: colors.card,
      borderRadius: 14,
      gap: 12,
    },
    placePhoto: {
      width: 72,
      height: 72,
      borderRadius: 10,
    },
    photoPlaceholder: {
      backgroundColor: colors.bg3,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    placeName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
    },
    placeMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    categoryPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: colors.accentBg,
    },
    categoryText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    ratingChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    ratingText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text2,
    },

    // Consensus
    consensusRow: {
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
      padding: 12,
      backgroundColor: colors.accentDim,
      borderRadius: 12,
      alignItems: 'center',
    },
    consensusText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.accent,
      marginBottom: 2,
    },
    summaryText: {
      fontSize: 12,
      color: colors.text2,
    },

    // Member list
    memberList: {
      marginHorizontal: 16,
      marginTop: 8,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
    },
    avatarFallback: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitial: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
    memberName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginLeft: 10,
    },

    // Vote badges
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    badgeYes: {
      backgroundColor: 'rgba(45,106,46,0.15)',
    },
    badgeNo: {
      backgroundColor: 'rgba(158,58,52,0.15)',
    },
    badgePending: {
      backgroundColor: colors.bg3,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    badgeYesText: {
      color: '#2d6a2e',
    },
    badgeNoText: {
      color: '#9e3a34',
    },
    badgePendingText: {
      color: colors.text3,
    },

    // Action buttons
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 20,
    },
    voteBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
    },
    voteBtnYes: {
      borderWidth: 1.5,
      borderColor: colors.accent,
      backgroundColor: 'transparent',
    },
    voteBtnActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    voteBtnNo: {
      borderWidth: 1.5,
      borderColor: colors.border2,
      backgroundColor: 'transparent',
    },
    voteBtnNoActive: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    voteBtnText: {
      fontSize: 15,
      fontWeight: '600',
    },
    voteBtnYesText: {
      color: colors.accent,
    },
    voteBtnActiveText: {
      color: colors.canvas,
    },
    voteBtnNoText: {
      color: colors.text2,
    },
    voteBtnNoActiveText: {
      color: '#fff',
    },

    // Tiebreaker
    tiebreakerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.accentDim,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    tiebreakerText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },

    // Next place
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 16,
      paddingVertical: 10,
    },
    nextBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },
  })
