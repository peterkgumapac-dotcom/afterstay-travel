import React, { useState, useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Animated,
  Modal, Pressable, Text, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Camera, FileText, Package, Receipt } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface FabAction {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  color: string;
  onPress: () => void;
}

export const FloatingActionButton: React.FC = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const menuAnims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  const actions: FabAction[] = [
    {
      id: 'moment',
      icon: Camera,
      label: 'Capture Moment',
      color: '#ec4899',
      onPress: () => router.push('/(tabs)/moments'),
    },
    {
      id: 'expense',
      icon: Receipt,
      label: 'Quick Expense',
      color: '#fbbf24',
      onPress: () => router.push('/add-expense'),
    },
    {
      id: 'pack',
      icon: Package,
      label: 'Add to Packing',
      color: '#a78bfa',
      onPress: () => router.push('/(tabs)/trip'),
    },
    {
      id: 'summary',
      icon: FileText,
      label: 'Trip Summary',
      color: '#2dd4a0',
      onPress: () => router.push('/trip-summary'),
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
                  <View style={styles.labelPill}>
                    <Text style={styles.labelText}>{action.label}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: action.color }]}
                    onPress={() => handleAction(action)}
                    activeOpacity={0.85}
                  >
                    <ActionIcon color="#fff" size={22} strokeWidth={2.5} />
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
      >
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Plus color="#000" size={28} strokeWidth={3} />
        </Animated.View>
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2dd4a0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2dd4a0',
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
    bottom: Platform.OS === 'ios' ? 175 : 165,
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
    backgroundColor: '#0f1318',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e2530',
  },
  labelText: {
    color: '#fff',
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
