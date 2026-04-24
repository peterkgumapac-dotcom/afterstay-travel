import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Animated,
  Modal, Pressable, Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Plus, Users, UserPlus, Camera, Package, Plane,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';

interface FabAction {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  color: string;
  onPress: () => void;
}

interface TripFabProps {
  onAddTrip: () => void;
  onAddEssentials: () => void;
}

export const TripFloatingActionButton: React.FC<TripFabProps> = ({
  onAddTrip,
  onAddEssentials,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const menuAnims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  const actions: FabAction[] = [
    {
      id: 'trip',
      icon: Plane,
      label: 'Add Trip',
      color: colors.fab1,
      onPress: onAddTrip,
    },
    {
      id: 'members',
      icon: Users,
      label: 'Add Members',
      color: colors.fab2,
      onPress: () => router.push('/add-member' as never),
    },
    {
      id: 'invite',
      icon: UserPlus,
      label: 'Invite Members',
      color: colors.fab3,
      onPress: () => router.push('/invite' as never),
    },
    {
      id: 'moment',
      icon: Camera,
      label: 'Add Moments',
      color: colors.fab4,
      onPress: () => router.push('/add-moment' as never),
    },
    {
      id: 'essentials',
      icon: Package,
      label: 'Add Essentials',
      color: (colors as any).fab5 ?? colors.accent,
      onPress: onAddEssentials,
    },
  ];

  useEffect(() => {
    if (open) {
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      menuAnims.forEach((anim, i) => {
        setTimeout(() => {
          Animated.spring(anim, {
            toValue: 1,
            friction: 6,
            tension: 80,
            useNativeDriver: true,
          }).start();
        }, i * 50);
      });
    } else {
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      menuAnims.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
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

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '135deg'],
  });

  return (
    <>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menuContainer} pointerEvents="box-none">
            {actions.map((action, i) => {
              const ActionIcon = action.icon;
              const translateY = menuAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              });

              return (
                <Animated.View
                  key={action.id}
                  style={[
                    styles.menuItem,
                    {
                      opacity: menuAnims[i],
                      transform: [
                        { translateY },
                        { scale: menuAnims[i] },
                      ],
                    },
                  ]}
                >
                  <TouchableOpacity style={styles.labelPill} onPress={() => handleAction(action)} activeOpacity={0.7}>
                    <Text style={styles.labelText}>{action.label}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: action.color }]}
                    onPress={() => handleAction(action)}
                    activeOpacity={0.85}
                  >
                    <ActionIcon color={colors.white} size={22} strokeWidth={2.5} />
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <TouchableOpacity
        style={styles.fab}
        onPress={toggle}
        activeOpacity={0.85}
        accessibilityLabel="Add to trip"
        accessibilityRole="button"
      >
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Plus color={colors.bg} size={28} strokeWidth={3} />
        </Animated.View>
      </TouchableOpacity>
    </>
  );
};

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menuContainer: {
    position: 'absolute',
    bottom: 175,
    right: 20,
    alignItems: 'flex-end',
    gap: 14,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  labelPill: {
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  labelText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});
