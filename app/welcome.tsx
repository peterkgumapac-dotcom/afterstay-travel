/**
 * Welcome — Value prop slides for first-time users.
 * 3 swipeable screens → "Get Started" or "Skip — just browsing"
 */

import { useRef, useState, useMemo } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Calendar, Camera, MapPin, Plane, Users, Wallet } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { updateProfile } from '@/lib/supabase';
import { completeOnboarding, setOnboardingProgress } from '@/lib/onboardingProgress';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const { width: SW } = Dimensions.get('window');

interface Slide {
  title: string;
  subtitle: string;
  icons: typeof Plane[];
  accent: string;
}

const SLIDES: Slide[] = [
  {
    title: 'Plan together',
    subtitle: 'Create trips, invite friends, vote on places — everyone stays in the loop.',
    icons: [Plane, Users, MapPin],
    accent: '#d8ab7a',
  },
  {
    title: 'Track everything',
    subtitle: 'Budget, expenses, receipts, packing lists — all in one place so nothing slips through.',
    icons: [Wallet, Calendar, Camera],
    accent: '#d9a441',
  },
  {
    title: 'Relive memories',
    subtitle: 'Photos, trip recaps, and AI-powered stories that capture the magic of every journey.',
    icons: [Camera, MapPin, Plane],
    accent: '#e38868',
  },
];

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const s = useMemo(() => getStyles(colors), [colors]);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const handleGetStarted = async () => {
    await setOnboardingProgress({ stage: 'path_picker' }, user?.id);
    router.replace('/onboarding');
  };

  const handleSkip = async () => {
    await completeOnboarding(user?.id, true);
    if (user?.id) {
      await updateProfile(user.id, { onboardedAt: new Date().toISOString() }).catch(() => {});
    }
    router.replace('/(tabs)/home' as never);
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Brand */}
      <Animated.View entering={FadeIn.duration(600)} style={s.brandRow}>
        <Text style={s.brandText}>
          after<Text style={s.brandAccent}>stay</Text>
        </Text>
      </Animated.View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={s.slide}>
            {/* Icon cluster */}
            <View style={s.iconCluster}>
              {item.icons.map((Icon: typeof Plane, i: number) => (
                <View key={i} style={[s.iconCircle, { backgroundColor: item.accent + '18', borderColor: item.accent + '40' }]}>
                  <Icon size={28} color={item.accent} strokeWidth={1.5} />
                </View>
              ))}
            </View>

            <Text style={s.slideTitle}>{item.title}</Text>
            <Text style={s.slideSub}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              {
                width: i === activeIndex ? 20 : 6,
                backgroundColor: i === activeIndex ? colors.accent : colors.border2,
              },
            ]}
          />
        ))}
      </View>

      {/* Actions */}
      <View style={s.actions}>
        {isLast ? (
          <Pressable style={s.primaryBtn} onPress={handleGetStarted}>
            <Text style={s.primaryBtnText}>Get Started</Text>
          </Pressable>
        ) : (
          <Pressable style={s.primaryBtn} onPress={handleNext}>
            <Text style={s.primaryBtnText}>Next</Text>
          </Pressable>
        )}
        <Pressable style={s.skipBtn} onPress={handleSkip}>
          <Text style={s.skipText}>Skip — just browsing</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },

    brandRow: { alignItems: 'center', paddingTop: 20, paddingBottom: 8 },
    brandText: { fontSize: 18, fontWeight: '400', color: colors.text2 },
    brandAccent: { color: colors.accent, fontStyle: 'italic', fontWeight: '500' },

    slide: {
      width: SW,
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      gap: 20,
    },
    iconCluster: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 12,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 20,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slideTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    slideSub: {
      fontSize: 15,
      color: colors.text2,
      textAlign: 'center',
      lineHeight: 22,
    },

    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 20,
    },
    dot: {
      height: 6,
      borderRadius: 3,
    },

    actions: {
      paddingHorizontal: 24,
      paddingBottom: 16,
      gap: 12,
    },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
    skipBtn: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    skipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text3,
    },
  });
