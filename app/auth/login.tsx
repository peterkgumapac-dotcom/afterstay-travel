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
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Circle as SvgCircle, Rect, Line, Polyline } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { spacing, radius } from '@/constants/theme';
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

/* ─── SVG Icons — exact copies from prototype ─── */

function AppleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" style={{ marginTop: -2 }}>
      <Path
        d="M17.6 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-2-3.7-2-1.6-.2-3.1 1-3.9 1-.8 0-2.1-.9-3.4-.9-1.7 0-3.4 1-4.3 2.6-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 2 2.7 3.3 2.6 1.3 0 1.8-.8 3.4-.8 1.6 0 2.1.8 3.4.8 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.7-1-2.8-4.4zM15 5.5c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.5-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.4z"
        fill="#fff"
      />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.3-.4-3.5z" />
    </Svg>
  );
}

function EmailIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" fill="none" />
      <Path d="M3 7l9 6 9-6" stroke="currentColor" fill="none" />
    </Svg>
  );
}

function SMSIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12a8 8 0 01-11.8 7L4 20.5l1.5-4.5A8 8 0 1121 12z" stroke="currentColor" fill="none" />
      <SvgCircle cx="8.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <SvgCircle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <SvgCircle cx="15.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  );
}

function ArrowIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" />
      <Polyline points="12 5 19 12 12 19" stroke="currentColor" fill="none" />
    </Svg>
  );
}

/* ─── Stagger animation helper ─── */

function StaggeredItem({ index, children }: { index: number; children: React.ReactNode }) {
  const translateY = useSharedValue(10);
  const itemOpacity = useSharedValue(0);

  useEffect(() => {
    const delay = (0.45 + index * 0.07) * 1000;
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 500, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }),
    );
    itemOpacity.value = withDelay(
      delay,
      withTiming(1, { duration: 500, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }),
    );
  }, [index, translateY, itemOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: itemOpacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

/* ─── Divider OR ─── */

function DividerOr({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={dividerStyles.row}>
      <View style={[dividerStyles.line, { backgroundColor: colors.border }]} />
      <Text style={[dividerStyles.text, { color: colors.text3 }]}>OR</Text>
      <View style={[dividerStyles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const dividerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    marginBottom: 2,
  },
  line: {
    flex: 1,
    height: 1,
  },
  text: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.18 * 10, // 0.18em * 10
  },
});

/* ─── SignInButton ─── */

function SignInButton({
  icon,
  label,
  bg,
  fg,
  borderColor,
  onPress,
  shadow,
}: {
  icon: React.ReactNode;
  label: string;
  bg: string;
  fg: string;
  borderColor: string;
  onPress: () => void;
  shadow?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        signInStyles.button,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: 1,
        },
        shadow && signInStyles.shadow,
      ]}
    >
      {icon}
      <Text style={[signInStyles.label, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const signInStyles = StyleSheet.create({
  button: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.01 * 14, // -0.01em
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
});

/* ─── PrimaryButton ─── */

function PrimaryButton({
  children,
  onPress,
  disabled,
  colors,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        primaryStyles.button,
        {
          backgroundColor: disabled ? colors.card2 : colors.black,
          borderColor: disabled ? colors.border : colors.black,
          borderWidth: 1,
        },
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[primaryStyles.text, { color: disabled ? colors.text3 : colors.onBlack }]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

const primaryStyles = StyleSheet.create({
  button: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.01 * 14,
  },
});

/* ─── FieldLabel ─── */

function FieldLabel({ children, colors }: { children: string; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <Text style={[fieldLabelStyles.label, { color: colors.text3 }]}>{children}</Text>
  );
}

const fieldLabelStyles = StyleSheet.create({
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.14 * 10, // 0.14em
    textTransform: 'uppercase',
    marginBottom: 8,
  },
});

/* ─── StyledInput ─── */

function StyledInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoFocus,
  keyboardType,
  autoCapitalize,
  autoComplete,
  prefix,
  colors,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoFocus?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
  autoComplete?: 'email' | 'password' | 'tel';
  prefix?: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        inputStyles.container,
        {
          backgroundColor: colors.card,
          borderColor: focused ? colors.accent : colors.border,
          borderWidth: 1,
        },
      ]}
    >
      {prefix ? (
        <View style={[inputStyles.prefixWrap, { borderRightColor: colors.border }]}>
          <Text style={[inputStyles.prefixText, { color: colors.text2 }]}>{prefix}</Text>
        </View>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        secureTextEntry={secureTextEntry}
        autoFocus={autoFocus}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[inputStyles.input, { color: colors.text }]}
      />
    </View>
  );
}

const inputStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    height: 50,
  },
  prefixWrap: {
    paddingRight: 8,
    borderRightWidth: 1,
  },
  prefixText: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.01 * 15,
  },
});

/* ─── Success icon with pop animation ─── */

function SuccessIcon({
  kind,
  colors,
}: {
  kind: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const scale = useSharedValue(0.8);
  const iconOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 180 });
    iconOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) });
  }, [scale, iconOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: iconOpacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View style={[
        successStyles.circle,
        {
          backgroundColor: colors.accentBg,
          borderColor: colors.accentBorder,
          borderWidth: 1,
        },
      ]}>
        <View style={{ color: colors.accent } as never}>
          {kind === 'email' ? <EmailIcon /> : <SMSIcon />}
        </View>
      </View>
    </Animated.View>
  );
}

const successStyles = StyleSheet.create({
  circle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* ─── Main screen ─── */

function getStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    /* nothing dynamic needed beyond inline colors */
  });
}

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signIn, signInWithMagicLink, session } = useAuth();
  const router = useRouter();

  const [panel, setPanel] = useState<Panel>('root');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleSignInWithPassword = async () => {
    if (!isEmailValid || !password) return;
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email.trim(), password);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      router.replace('/(tabs)/home' as never);
    }
  };

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
          {panel === 'root' && renderRootPanel()}
          {panel === 'email' && renderEmailPanel()}
          {panel === 'phone' && renderPhonePanel()}
          {panel === 'sent' && renderSentPanel()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  function renderRootPanel() {
    return (
      <>
        <ConstellationHero />

        <View style={styles.body}>
          {/* Heading block */}
          <StaggeredItem index={0}>
            <View style={styles.headingBlock}>
              <Text style={[styles.heading, { color: colors.text }]}>Welcome in.</Text>
              <Text style={[styles.subtitle, { color: colors.text2 }]}>
                Your trip doesn&apos;t end at checkout. Sign in to keep the moments, the memories, the next one.
              </Text>
            </View>
          </StaggeredItem>

          {/* Button group */}
          <View style={styles.buttonGroup}>
            {/* Apple */}
            <StaggeredItem index={1}>
              <SignInButton
                onPress={() => Alert.alert('Coming Soon', 'Apple Sign-In will be available soon.')}
                icon={<AppleIcon />}
                label="Continue with Apple"
                bg="#000"
                fg="#fff"
                borderColor="#000"
                shadow
              />
            </StaggeredItem>

            {/* Google */}
            <StaggeredItem index={2}>
              <SignInButton
                onPress={() => Alert.alert('Coming Soon', 'Google Sign-In will be available soon.')}
                icon={<GoogleIcon />}
                label="Continue with Google"
                bg="#fff"
                fg="#1f1f1f"
                borderColor="#dadce0"
                shadow
              />
            </StaggeredItem>

            {/* OR divider */}
            <StaggeredItem index={3}>
              <DividerOr colors={colors} />
            </StaggeredItem>

            {/* Email */}
            <StaggeredItem index={4}>
              <SignInButton
                onPress={() => resetToPanel('email')}
                icon={<View style={{ color: colors.text } as never}><EmailIcon /></View>}
                label="Continue with email"
                bg={colors.card}
                fg={colors.text}
                borderColor={colors.border}
              />
            </StaggeredItem>

            {/* Phone */}
            <StaggeredItem index={5}>
              <SignInButton
                onPress={() => resetToPanel('phone')}
                icon={<View style={{ color: colors.text } as never}><SMSIcon /></View>}
                label="Continue with phone"
                bg={colors.card}
                fg={colors.text}
                borderColor={colors.border}
              />
            </StaggeredItem>
          </View>

          {/* Social proof strip */}
          <StaggeredItem index={6}>
            <View style={[styles.socialProof, { backgroundColor: colors.card2, borderColor: colors.border }]}>
              <View style={styles.avatarRow}>
                {['#a64d1e', '#c66a36', '#b8892b'].map((c, i) => (
                  <View
                    key={c}
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: c,
                        marginLeft: i === 0 ? 0 : -6,
                        borderColor: colors.card2,
                        borderWidth: 2,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.socialText, { color: colors.text2 }]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Peter, Aaron &amp; Jane</Text>
                {' '}are already on Afterstay.
              </Text>
            </View>
          </StaggeredItem>

          {/* Legal */}
          <StaggeredItem index={7}>
            <Text style={[styles.legal, { color: colors.text3 }]}>
              By continuing you agree to our{' '}
              <Text style={[styles.legalLink, { color: colors.accent, textDecorationColor: colors.accentBorder }]}>Terms</Text>
              {' '}&amp;{' '}
              <Text style={[styles.legalLink, { color: colors.accent, textDecorationColor: colors.accentBorder }]}>Privacy</Text>.
            </Text>
          </StaggeredItem>
        </View>
      </>
    );
  }

  function renderEmailPanel() {
    return (
      <>

        <View style={styles.body}>
          {/* Heading */}
          <View style={styles.headingBlock}>
            <Text style={[styles.subHeading, { color: colors.text }]}>Sign in with email</Text>
            <Text style={[styles.subText, { color: colors.text2 }]}>
              We'll send a secure link — no password to remember.
            </Text>
          </View>

          {/* Fields */}
          <View style={styles.fieldGroup}>
            <View>
              <FieldLabel colors={colors}>Email</FieldLabel>
              <StyledInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                colors={colors}
              />
            </View>

            <View>
              <FieldLabel colors={colors}>Password</FieldLabel>
              <StyledInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry
                autoComplete="password"
                colors={colors}
              />
            </View>

            {error ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            ) : null}

            {/* Sign In (password) */}
            <PrimaryButton
              onPress={handleSignInWithPassword}
              disabled={!isEmailValid || !password || loading}
              colors={colors}
            >
              {loading ? (
                <ActivityIndicator color={colors.onBlack} size="small" />
              ) : (
                <>
                  <Text style={[primaryStyles.text, { color: !isEmailValid || !password ? colors.text3 : colors.onBlack }]}>
                    Sign In
                  </Text>
                  <ArrowIcon />
                </>
              )}
            </PrimaryButton>

            {/* OR divider */}
            <DividerOr colors={colors} />

            {/* Send magic link */}
            <TouchableOpacity
              onPress={handleSendMagicLink}
              disabled={!isEmailValid || loading}
              activeOpacity={0.8}
              style={[
                styles.ghostButton,
                {
                  borderColor: colors.accentBorder,
                  opacity: !isEmailValid ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.ghostButtonText, { color: colors.accent }]}>
                Send magic link instead
              </Text>
            </TouchableOpacity>
          </View>

          {/* Back link */}
          <TouchableOpacity
            onPress={() => resetToPanel('root')}
            style={styles.backLink}
          >
            <Text style={[styles.backLinkText, { color: colors.text3 }]}>
              {'\u2190'} Back to sign-in options
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderPhonePanel() {
    const phoneDigits = phone.replace(/\D/g, '');
    const isPhoneValid = phoneDigits.length >= 7;

    return (
      <>
        <View style={styles.body}>
          {/* Heading */}
          <View style={styles.headingBlock}>
            <Text style={[styles.subHeading, { color: colors.text }]}>Sign in with phone</Text>
            <Text style={[styles.subText, { color: colors.text2 }]}>
              Get a one-time code to verify your number.
            </Text>
          </View>

          {/* Fields */}
          <View style={styles.fieldGroup}>
            <View>
              <FieldLabel colors={colors}>Mobile number</FieldLabel>
              <View style={styles.phoneRow}>
                {/* Country code chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={[
                    styles.countryPicker,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  {COUNTRY_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.code}
                      onPress={() => setCountryCode(opt.code)}
                      style={[
                        styles.countryChip,
                        countryCode === opt.code && {
                          backgroundColor: colors.accentBg,
                          borderColor: colors.accentBorder,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[styles.countryChipText, { color: colors.text, fontWeight: countryCode === opt.code ? '600' : '400' }]}>
                        {opt.flag} {opt.code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Phone input with prefix */}
                <StyledInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="917 555 0123"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  autoFocus
                  prefix={countryCode}
                  colors={colors}
                />
              </View>
              <Text style={[styles.metaText, { color: colors.text3 }]}>
                We'll text you a 6-digit code. Standard message rates may apply.
              </Text>
            </View>

            {/* Send code */}
            <PrimaryButton
              onPress={handlePhoneSend}
              disabled={!isPhoneValid}
              colors={colors}
            >
              <Text style={[primaryStyles.text, { color: !isPhoneValid ? colors.text3 : colors.onBlack }]}>
                Send verification code
              </Text>
              <ArrowIcon />
            </PrimaryButton>
          </View>

          {/* Back link */}
          <TouchableOpacity
            onPress={() => resetToPanel('root')}
            style={styles.backLink}
          >
            <Text style={[styles.backLinkText, { color: colors.text3 }]}>
              {'\u2190'} Back to sign-in options
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderSentPanel() {
    const isEmail = sentTarget.kind === 'email';

    return (
      <>
        <View style={[styles.body, { alignItems: 'center' }]}>
          <View style={styles.sentContent}>
            {/* Success icon */}
            <SuccessIcon kind={sentTarget.kind} colors={colors} />

            {/* Text block */}
            <View style={styles.sentTextBlock}>
              <Text style={[styles.sentHeading, { color: colors.text }]}>
                {isEmail ? 'Check your inbox' : 'Check your messages'}
              </Text>
              <Text style={[styles.sentSubtext, { color: colors.text2 }]}>
                We sent a {isEmail ? 'magic link' : '6-digit code'} to{'\n'}
                <Text style={{ color: colors.text, fontWeight: '600' }}>{sentTarget.target}</Text>
              </Text>
            </View>

            {/* Continue button */}
            <View style={{ width: '100%', marginTop: 4 }}>
              <PrimaryButton
                onPress={() => {
                  if (session) {
                    router.replace('/(tabs)/home' as never);
                  }
                }}
                disabled={!session}
                colors={colors}
              >
                <Text style={[primaryStyles.text, { color: !session ? colors.text3 : colors.onBlack }]}>
                  Continue to Afterstay
                </Text>
              </PrimaryButton>
            </View>

            {/* Back link */}
            <TouchableOpacity
              onPress={() => resetToPanel(isEmail ? 'email' : 'phone')}
              style={styles.sentBackLink}
            >
              <Text style={[styles.sentBackLinkText, { color: colors.text3 }]}>
                Use a different {isEmail ? 'email' : 'number'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
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
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  headingBlock: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 26,
    lineHeight: 26 * 1.1,
    letterSpacing: -0.03 * 26,
    fontWeight: '500',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 13.5 * 1.5,
    maxWidth: 310,
  },
  subHeading: {
    fontSize: 24,
    lineHeight: 24 * 1.1,
    letterSpacing: -0.03 * 24,
    fontWeight: '500',
    marginBottom: 6,
  },
  subText: {
    fontSize: 13,
    lineHeight: 13 * 1.45,
  },
  buttonGroup: {
    gap: 10,
  },
  fieldGroup: {
    gap: 14,
  },
  ghostButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  backLink: {
    alignSelf: 'center',
    padding: 8,
  },
  backLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  avatarRow: {
    flexDirection: 'row',
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 999,
  },
  socialText: {
    fontSize: 11.5,
    lineHeight: 11.5 * 1.4,
    flex: 1,
  },
  legal: {
    marginTop: 18,
    fontSize: 10.5,
    textAlign: 'center',
    lineHeight: 10.5 * 1.55,
    letterSpacing: 0.01 * 10.5,
  },
  legalLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  phoneRow: {
    gap: 8,
  },
  countryPicker: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    flexDirection: 'row',
  },
  countryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  countryChipText: {
    fontSize: 14,
  },
  metaText: {
    fontSize: 11,
    lineHeight: 11 * 1.5,
    marginTop: 8,
  },
  sentContent: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 6,
  },
  sentTextBlock: {
    alignItems: 'center',
  },
  sentHeading: {
    fontSize: 22,
    letterSpacing: -0.02 * 22,
    fontWeight: '500',
    marginBottom: 6,
  },
  sentSubtext: {
    fontSize: 13,
    lineHeight: 13 * 1.5,
    textAlign: 'center',
    maxWidth: 280,
  },
  sentBackLink: {
    padding: 4,
  },
  sentBackLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
