import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native'
import { X, RotateCcw } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { useTheme } from '@/constants/ThemeContext'
import {
  submitRpsMove,
  subscribeToPlaceRps,
  resetRpsGame,
  type RPSMove,
  type RPSGameState,
} from '@/lib/supabase'
import type { PlaceVote, GroupMember } from '@/lib/types'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.65

const MOVES: { id: RPSMove; emoji: string; label: string }[] = [
  { id: 'rock', emoji: '🪨', label: 'Rock' },
  { id: 'paper', emoji: '📄', label: 'Paper' },
  { id: 'scissors', emoji: '✂️', label: 'Scissors' },
]

const MEMBER_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b']

interface RPSTiebreakerSheetProps {
  visible: boolean
  onClose: () => void
  placeId: string
  placeName: string
  members: GroupMember[]
  currentMemberId: string
  memberVotes: Record<string, PlaceVote>
  onSettled?: (placeId: string, winnerVote: PlaceVote) => void
}

export default function RPSTiebreakerSheet({
  visible,
  onClose,
  placeId,
  placeName,
  members,
  currentMemberId,
  memberVotes,
  onSettled,
}: RPSTiebreakerSheetProps) {
  const { colors } = useTheme()
  const s = getStyles(colors)

  const [gameState, setGameState] = useState<RPSGameState | null>(null)
  const [myMove, setMyMove] = useState<RPSMove | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Pulse animation for waiting state
  const pulse = useSharedValue(1)
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.3 + pulse.value * 0.4,
  }))

  useEffect(() => {
    if (visible) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800 }),
          withTiming(1, { duration: 800 }),
        ),
        -1,
        true,
      )
    }
  }, [visible])

  // Reset on open
  useEffect(() => {
    if (visible) {
      setMyMove(null)
      setGameState(null)
    }
  }, [visible])

  // Subscribe to realtime game state updates
  useEffect(() => {
    if (!visible || !placeId) return
    const unsub = subscribeToPlaceRps(placeId, (state) => {
      setGameState(state)
      if (state?.status === 'settled' && state.winnerVote) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onSettled?.(placeId, state.winnerVote as PlaceVote)
      }
    })
    return unsub
  }, [visible, placeId])

  const handlePickMove = useCallback(
    async (move: RPSMove) => {
      if (submitting || myMove) return
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setMyMove(move)
      setSubmitting(true)
      try {
        const result = await submitRpsMove(
          placeId,
          currentMemberId,
          move,
          members.length,
          memberVotes,
        )
        setGameState(result)
        if (result.status === 'settled' && result.winnerVote) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          onSettled?.(placeId, result.winnerVote as PlaceVote)
        }
      } catch {
        setMyMove(null)
      } finally {
        setSubmitting(false)
      }
    },
    [placeId, currentMemberId, members.length, memberVotes, submitting, myMove],
  )

  const handleRematch = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await resetRpsGame(placeId).catch(() => {})
    setMyMove(null)
    setGameState(null)
  }, [placeId])

  const waitingFor = useMemo(() => {
    if (!gameState?.moves) return members.length
    return members.length - Object.keys(gameState.moves).length
  }, [gameState, members.length])

  const isSettled = gameState?.status === 'settled'
  const isTie = gameState?.status === 'playing' && gameState.round > 1 && Object.keys(gameState.moves).length === 0
  const winnerName = isSettled && gameState.winner
    ? members.find((m) => m.id === gameState.winner)?.name ?? 'Someone'
    : null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          {/* Handle */}
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>
              {isSettled ? 'Settled!' : isTie ? 'Tie! Go again' : 'Settle it! 🎲'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <X size={22} color={colors.text2} />
            </TouchableOpacity>
          </View>

          <Text style={s.subtitle} numberOfLines={1}>
            {placeName}
            {gameState?.round && gameState.round > 1 ? ` · Round ${gameState.round}` : ''}
          </Text>

          {/* Result state */}
          {isSettled ? (
            <Animated.View entering={ZoomIn.springify()} style={s.resultWrap}>
              <Text style={s.resultEmoji}>
                {gameState.winnerVote === '👍 Yes' ? '🎉' : '👋'}
              </Text>
              <Text style={s.resultTitle}>
                {gameState.winnerVote === '👍 Yes' ? 'Going!' : 'Skipped'}
              </Text>
              <Text style={s.resultSub}>
                {winnerName}'s vote wins
              </Text>

              {/* Show all moves */}
              <View style={s.movesReveal}>
                {members.map((m, i) => {
                  const move = gameState.moves[m.id]
                  const moveInfo = MOVES.find((mv) => mv.id === move)
                  const isWinner = m.id === gameState.winner
                  return (
                    <Animated.View
                      key={m.id}
                      entering={FadeInDown.delay(i * 120).springify()}
                      style={[s.moveRevealRow, isWinner && s.moveRevealWinner]}
                    >
                      <View style={[s.moveAvatar, { backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }]}>
                        <Text style={s.moveAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={s.moveRevealName}>{m.name}</Text>
                      <Text style={s.moveRevealEmoji}>{moveInfo?.emoji ?? '?'}</Text>
                    </Animated.View>
                  )
                })}
              </View>

              <View style={s.resultActions}>
                <TouchableOpacity style={s.rematchBtn} onPress={handleRematch}>
                  <RotateCcw size={16} color={colors.accent} />
                  <Text style={s.rematchText}>Rematch</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.acceptBtn} onPress={onClose}>
                  <Text style={s.acceptText}>Done</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : !myMove ? (
            /* Pick your move */
            <Animated.View entering={FadeIn.duration(300)} style={s.movePicker}>
              <Text style={s.pickLabel}>Pick your move</Text>
              <View style={s.moveRow}>
                {MOVES.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={s.moveBtn}
                    onPress={() => handlePickMove(m.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.moveBtnEmoji}>{m.emoji}</Text>
                    <Text style={s.moveBtnLabel}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          ) : (
            /* Waiting for others */
            <View style={s.waitingWrap}>
              <Animated.View style={[s.waitingPulse, pulseStyle]}>
                <Text style={s.waitingEmoji}>
                  {MOVES.find((m) => m.id === myMove)?.emoji}
                </Text>
              </Animated.View>
              <Text style={s.waitingTitle}>You picked {myMove}</Text>
              <Text style={s.waitingSub}>
                Waiting for {waitingFor} other{waitingFor !== 1 ? 's' : ''}...
              </Text>

              {/* Member status dots */}
              <View style={s.memberDots}>
                {members.map((m, i) => {
                  const hasPlayed = gameState?.moves?.[m.id] != null
                  return (
                    <View key={m.id} style={s.memberDotRow}>
                      <View style={[
                        s.memberDot,
                        { backgroundColor: hasPlayed ? '#2d6a2e' : colors.text3 },
                      ]} />
                      <Text style={[s.memberDotName, hasPlayed && { color: colors.text }]}>
                        {m.name}{m.id === currentMemberId ? ' (you)' : ''}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

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
      paddingBottom: 32,
    },
    handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.text3 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    title: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text },
    closeBtn: { padding: 4 },
    subtitle: {
      fontSize: 13,
      color: colors.text2,
      paddingHorizontal: 16,
      marginBottom: 16,
    },

    // Move picker
    movePicker: { alignItems: 'center', paddingHorizontal: 16 },
    pickLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text2,
      marginBottom: 16,
    },
    moveRow: {
      flexDirection: 'row',
      gap: 12,
    },
    moveBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 20,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      gap: 8,
    },
    moveBtnEmoji: { fontSize: 36 },
    moveBtnLabel: { fontSize: 13, fontWeight: '600', color: colors.text },

    // Waiting
    waitingWrap: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
    waitingPulse: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accentDim,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    waitingEmoji: { fontSize: 36 },
    waitingTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
    waitingSub: { fontSize: 13, color: colors.text2, marginBottom: 16 },
    memberDots: { gap: 6, alignSelf: 'stretch', paddingHorizontal: 24 },
    memberDotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    memberDot: { width: 8, height: 8, borderRadius: 4 },
    memberDotName: { fontSize: 13, color: colors.text3 },

    // Result
    resultWrap: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
    resultEmoji: { fontSize: 48, marginBottom: 8 },
    resultTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
    resultSub: { fontSize: 14, color: colors.text2, marginBottom: 20 },
    movesReveal: { gap: 6, alignSelf: 'stretch', marginBottom: 20 },
    moveRevealRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    moveRevealWinner: {
      backgroundColor: colors.accentDim,
    },
    moveAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    moveAvatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    moveRevealName: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },
    moveRevealEmoji: { fontSize: 22 },

    resultActions: {
      flexDirection: 'row',
      gap: 10,
      alignSelf: 'stretch',
    },
    rematchBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border2,
    },
    rematchText: { fontSize: 15, fontWeight: '600', color: colors.accent },
    acceptBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.accent,
    },
    acceptText: { fontSize: 15, fontWeight: '600', color: colors.canvas },
  })
