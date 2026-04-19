import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Mail, MessageCircle } from 'lucide-react-native';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { spacing, radius, typography } from '@/constants/theme';
import ConstellationHero from '@/components/auth/ConstellationHero';

type Panel = 'root' | 'email' | 'phone' | 'sent';

interface CountryOption {
  flag: string;
  code: string;
}

const COUNTRY_OPTIONS: readonly CountryOption[] = [
  { flag: '\u{1F1F5}\u{1F1ED}', code: '+63' },
  { flag: '\u{1F1FA}\u{1F1F8}', code: '+1' },
  { flag: '\u{1F1EC}\u{1F1E7}', code: '+44' },
  { flag: '\u{1F1E6}\u{1F1FA}', code: '+61' },
  { flag: '\u{1F1F8}\u{1F1EC}', code: '+65' },
  { flag: '\u{1F1EF}\u{1F1F5}', code: '+81' },
  { flag: '\u{1F1EE}\u{1F1F3}', code: '+91' },
] as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AppleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
        fill="#fff"
      />
    </Svg>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function StaggeredButton({
  index,
  onPress,
  style,
  children,
}: {
  index: number;
  onPress: () => void;
  style: object;
  children: React.ReactNode;
}) {
  const translateY = useSharedValue(10);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      index * 100,
      withSpring(0, { damping: 16, stiffness: 140 }),
    );
    opacity.value = withDelay(
      index * 100,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.ease) }),
    );
  }, [index, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={style}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function SuccessIcon({
  kind,
  accentColor,
}: {
  kind: string;
  accentColor: string;
}) {
  const scale = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 160 });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View style={[styles.successCircle, { backgroundColor: accentColor }]}>
        {kind === 'email' ? (
          <Mail size={28} color="#fff" />
        ) : (
          <MessageCircle size={28} color="#fff" />
        )}
      </View>
    </Animated.View>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    heading: {
      fontSize: 26,
      ...typography.display,
      color: colors.text,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text2,
    },
    subHeading: {
      fontSize: 24,
      ...typography.display,
      color: colors.text,
    },
    subText: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.text2,
    },
    input: {
      fontSize: 15,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      borderRadius: radius.md,
      borderWidth: 1,
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.text,
    },
    primaryButton: {
      paddingVertical: 15,
      borderRadius: radius.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.accent,
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: colors.onBlack,
    },
    backLink: {
      paddingVertical: spacing.sm,
    },
    backLinkText: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.accent,
    },
    errorText: {
      fontSize: 13,
      color: colors.danger,
      textAlign: 'center' as const,
    },
  });
}

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signInWithMagicLink, session } = useAuth();
  const router = useRouter();
  const themed = getStyles(colors);

  const [panel, setPanel] = useState<Panel>('root');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+63');
  const [sentTarget, setSentTarget] = useState({ kind: '', target: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-redirect when session appears (user clicked magic link)
  useEffect(() => {
    if (session && panel === 'sent') {
      router.replace('/(tabs)/home' as never);
    }
  }, [session, panel, router]);

  const isEmailValid = EMAIL_REGEX.test(email.trim());

  const handleSendMagicLink = async () => {
    if (!isEmailValid) return;
    setLoading(true);
    setError(null);
    const { error: err } = await signInWithMagicLink(email.trim());
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      setLoading(false);
      setSentTarget({ kind: 'email', target: email.trim() });
      setPanel('sent');
    }
  };

  const handlePhoneSend = () => {
    Alert.alert('Coming Soon', 'Phone sign-in will be available soon.');
  };

  const resetToPanel = (target: Panel) => {
    setError(null);
    setPanel(target);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {panel === 'root' && <RootPanel />}
          {panel === 'email' && <EmailPanel />}
          {panel === 'phone' && <PhonePanel />}
          {panel === 'sent' && <SentPanel />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  function RootPanel() {
    return (
      <>
        <ConstellationHero />

        <View style={styles.body}>
          <View style={styles.headingBlock}>
            <Text style={themed.heading}>Welcome in.</Text>
            <Text style={themed.subtitle}>
              Your trip doesn&apos;t end at checkout. Sign in to keep the moments, the memories, the
              next one.
            </Text>
          </View>

          <View style={styles.buttonGroup}>
            <StaggeredButton
              index={0}
              onPress={() =>
                Alert.alert('Coming Soon', 'Apple Sign-In will be available soon.')
              }
              style={styles.appleButton}
            >
              <AppleIcon />
              <Text style={styles.appleButtonText}>Continue with Apple</Text>
            </StaggeredButton>

            <StaggeredButton
              index={1}
              onPress={() =>
                Alert.alert('Coming Soon', 'Google Sign-In will be available soon.')
              }
              style={styles.googleButton}
            >
              <GoogleIcon />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </StaggeredButton>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.text3 }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <StaggeredButton
              index={2}
              onPress={() => resetToPanel('email')}
              style={[styles.optionButton, { backgroundColor: colors.card }]}
            >
              <Mail size={18} color={colors.text} />
              <Text style={[styles.optionButtonText, { color: colors.text }]}>
                Continue with email
              </Text>
            </StaggeredButton>

            <StaggeredButton
              index={3}
              onPress={() => resetToPanel('phone')}
              style={[styles.optionButton, { backgroundColor: colors.card }]}
            >
              <MessageCircle size={18} color={colors.text} />
              <Text style={[styles.optionButtonText, { color: colors.text }]}>
                Continue with phone
              </Text>
            </StaggeredButton>
          </View>

          <View style={styles.socialProof}>
            <View style={styles.avatarRow}>
              {['#a64d1e', '#b8892b', '#c66a36'].map((bg, i) => (
                <View
                  key={bg}
                  style={[
                    styles.avatar,
                    { backgroundColor: bg, marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.socialText, { color: colors.text3 }]}>
              Peter, Aaron &amp; Jane are already on Afterstay.
            </Text>
          </View>

          <Text style={[styles.legal, { color: colors.text3 }]}>
            By continuing you agree to our Terms &amp; Privacy.
          </Text>
        </View>
      </>
    );
  }

  function EmailPanel() {
    return (
      <View style={styles.panelBody}>
        <View style={styles.headingBlock}>
          <Text style={themed.subHeading}>Sign in with email</Text>
          <Text style={themed.subText}>
            We&apos;ll send a secure link — no password to remember.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <TextInput
            style={themed.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.text3}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            autoFocus
          />

          {error ? <Text style={themed.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[themed.primaryButton, !isEmailValid && styles.disabledButton]}
            onPress={handleSendMagicLink}
            disabled={!isEmailValid || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.onBlack} size="small" />
            ) : (
              <Text style={themed.primaryButtonText}>Send magic link</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={themed.backLink}
          onPress={() => resetToPanel('root')}
        >
          <Text style={themed.backLinkText}>{'\u2190'} Back to sign-in options</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function PhonePanel() {
    return (
      <View style={styles.panelBody}>
        <View style={styles.headingBlock}>
          <Text style={themed.subHeading}>Sign in with phone</Text>
          <Text style={themed.subText}>
            Get a one-time code to verify your number.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.phoneRow}>
            <View style={[styles.countryPicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {COUNTRY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.code}
                    onPress={() => setCountryCode(opt.code)}
                    style={[
                      styles.countryChip,
                      countryCode === opt.code && { backgroundColor: colors.accentDim },
                    ]}
                  >
                    <Text style={[styles.countryChipText, { color: colors.text }]}>
                      {opt.flag} {opt.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <TextInput
            style={themed.input}
            placeholder="Phone number"
            placeholderTextColor={colors.text3}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
          />

          <TouchableOpacity
            style={themed.primaryButton}
            onPress={handlePhoneSend}
            activeOpacity={0.8}
          >
            <Text style={themed.primaryButtonText}>Send verification code</Text>
          </TouchableOpacity>

          <Text style={[styles.metaText, { color: colors.text3 }]}>
            We&apos;ll text you a 6-digit code. Standard message rates may apply.
          </Text>
        </View>

        <TouchableOpacity
          style={themed.backLink}
          onPress={() => resetToPanel('root')}
        >
          <Text style={themed.backLinkText}>{'\u2190'} Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function SentPanel() {
    const isEmail = sentTarget.kind === 'email';

    return (
      <View style={styles.sentBody}>
        <SuccessIcon kind={sentTarget.kind} accentColor={colors.accent} />

        <View style={styles.sentTextBlock}>
          <Text style={themed.subHeading}>
            {isEmail ? 'Check your inbox' : 'Check your messages'}
          </Text>
          <Text style={themed.subText}>
            We sent a magic link to{' '}
            <Text style={{ color: colors.accent, fontWeight: '700' }}>
              {sentTarget.target}
            </Text>
          </Text>
        </View>

        <Text style={{ color: colors.text3, fontSize: 12, textAlign: 'center', marginBottom: spacing.sm }}>
          Click the link in your email, then you'll be signed in automatically.
        </Text>

        <TouchableOpacity
          style={themed.primaryButton}
          onPress={() => {
            // Only navigate if session exists (user clicked magic link)
            if (session) {
              router.replace('/(tabs)/home' as never);
            }
          }}
          activeOpacity={0.8}
          disabled={!session}
        >
          <Text style={[themed.primaryButtonText, !session && { opacity: 0.5 }]}>
            {session ? 'Continue to Afterstay' : 'Waiting for magic link…'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={themed.backLink}
          onPress={() => resetToPanel(isEmail ? 'email' : 'phone')}
        >
          <Text style={themed.backLinkText}>
            Use a different {isEmail ? 'email' : 'phone number'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.xxl,
  },
  panelBody: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: 60,
    gap: spacing.xxl,
  },
  sentBody: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: 100,
    alignItems: 'center',
    gap: spacing.xxl,
  },
  sentTextBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  headingBlock: {
    gap: spacing.sm,
  },
  buttonGroup: {
    gap: spacing.md,
  },
  fieldGroup: {
    gap: spacing.md,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#000',
    paddingVertical: 15,
    borderRadius: radius.md,
  },
  appleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 15,
    borderRadius: radius.md,
  },
  optionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  socialText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  legal: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  phoneRow: {
    gap: spacing.sm,
  },
  countryPicker: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  countryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
  countryChipText: {
    fontSize: 14,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 17,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
