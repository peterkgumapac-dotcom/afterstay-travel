import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Animated,
  Modal, Pressable, Text, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus, Camera, Receipt, Plane, UserPlus, Package,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { getActiveTrip, getGroupMembers } from '@/lib/supabase';

interface FabAction {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  onPress: () => void;
}

export const FloatingActionButton: React.FC = () => {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [transport, setTransport] = useState<string | undefined>();
  const [memberCount, setMemberCount] = useState(0);

  // Load trip context for conditional actions
  useEffect(() => {
    getActiveTrip().then((trip) => {
      if (trip) {
        setTransport(trip.transport);
        getGroupMembers(trip.id).then((m) => setMemberCount(m.length)).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const isPlane = !transport || transport === 'plane';

  const actions: FabAction[] = useMemo(() => {
    const items: FabAction[] = [
      { id: 'moment', icon: Camera, label: 'Capture Moment', onPress: () => router.push('/add-moment') },
      { id: 'expense', icon: Receipt, label: 'Quick Expense', onPress: () => router.push('/scan-receipt') },
    ];
    // Show invite action — always available so users can grow their group
    items.push({ id: 'invite', icon: UserPlus, label: memberCount >= 2 ? 'Invite Members' : 'Invite Companions', onPress: () => router.push('/invite' as never) });
    // Show Plan Trip only for plane transport or unset
    if (isPlane) {
      items.push({ id: 'trip', icon: Plane, label: 'Plan Trip', onPress: () => router.push('/trip-planner') });
    }
    items.push({ id: 'pack', icon: Package, label: 'Packing List', onPress: () => router.push('/(tabs)/trip') });
    return items;
  }, [isPlane, memberCount, router]);

  // Allocate max possible anims (5) so ref is stable across action count changes
  const menuAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;

  const bottomOffset = Platform.OS === 'ios' ? Math.max(insets.bottom, 20) : 16;
  // Position FAB just above the tab bar (tab bar height ~56 + padding)
  const fabBottom = bottomOffset + 68;

  // Pulse ring animation
  useEffect(() => {
    if (open) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [open]);

  useEffect(() => {
    if (open) {
      Animated.timing(rotateAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      menuAnims.forEach((anim, i) => {
        setTimeout(() => {
          Animated.spring(anim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
        }, (actions.length - 1 - i) * 50);
      });
    } else {
      Animated.timing(rotateAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      menuAnims.forEach((anim) => {
        Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      });
    }
  }, [open]);

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOpen(!open);
  };

  const handleAction = (action: FabAction) => {
    Haptics.selectionAsync();
    setOpen(false);
    setTimeout(() => action.onPress(), 200);
  };

  const rotation = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] });
  const pulseScale = pulseAnim;
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [1, 1.5], outputRange: [0.4, 0] });

  return (
    <>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          {/* Action items */}
          <View style={[s.menuContainer, { bottom: fabBottom + 70 }]}>
            {actions.map((action, i) => {
              const ActionIcon = action.icon;
              const translateY = menuAnims[i].interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
              return (
                <Animated.View
                  key={action.id}
                  style={[s.menuItem, {
                    opacity: menuAnims[i],
                    transform: [{ translateY }, { scale: menuAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                  }]}
                >
                  <TouchableOpacity style={s.labelPill} onPress={() => handleAction(action)} activeOpacity={0.7}>
                    <Text style={s.labelText}>{action.label}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionDot} onPress={() => handleAction(action)} activeOpacity={0.85}>
                    <ActionIcon color={colors.accent} size={20} strokeWidth={2} />
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          {/* FAB in open state */}
          <TouchableOpacity
            style={[s.fab, s.fabOpen, { bottom: fabBottom }]}
            onPress={toggle}
            activeOpacity={0.85}
          >
            <Animated.View style={{ transform: [{ rotate: rotation }] }}>
              <Plus color={colors.bg} size={22} strokeWidth={2.5} />
            </Animated.View>
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {/* FAB -- idle state */}
      <View style={[s.fabWrap, { bottom: fabBottom }]} pointerEvents="box-none">
        {/* Pulse ring */}
        {!open && (
          <Animated.View style={[s.pulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
        )}
        <TouchableOpacity
          style={s.fab}
          onPress={toggle}
          activeOpacity={0.85}
          accessibilityLabel="Quick actions"
          accessibilityRole="button"
        >
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Plus color={colors.bg} size={22} strokeWidth={2.5} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
};

const FAB_SIZE = 48;

const getStyles = (c: ThemeColors) => StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    width: FAB_SIZE,
    height: FAB_SIZE,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: c.accent,
    opacity: 0.92,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: c.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  fabOpen: {
    position: 'absolute',
    right: 20,
    backgroundColor: c.accentLt,
    opacity: 1,
    ...Platform.select({
      ios: {
        shadowColor: c.accent,
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
    zIndex: 100,
  },
  pulseRing: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    borderWidth: 1.5,
    borderColor: c.accent,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  menuContainer: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labelPill: {
    backgroundColor: `${c.bg}F2`, // ~95% opacity
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  labelText: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  actionDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${c.card}F2`, // ~95% opacity
    borderWidth: 1,
    borderColor: c.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
});
