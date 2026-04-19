// PLACEHOLDER — replace with your Claude Design login page.
// This file uses useAuth().signIn(email, password) to authenticate.
// Your design just needs to call signIn and handle the error.

import { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { spacing, radius } from '@/constants/theme';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Enter email and password');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email.trim(), password);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      router.replace('/(tabs)/home' as any);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.container}>
          {/* Logo / Branding */}
          <View style={styles.brandSection}>
            <Text style={[styles.logo, { color: colors.accent }]}>AfterStay</Text>
            <Text style={[styles.tagline, { color: colors.text2 }]}>
              Your group travel companion
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.text3}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Password"
              placeholderTextColor={colors.text3}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            {error && (
              <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.accent }]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.onBlack} size="small" />
              ) : (
                <Text style={[styles.buttonText, { color: colors.onBlack }]}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: 40,
  },
  brandSection: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
  },
  form: {
    gap: spacing.md,
  },
  input: {
    fontSize: 15,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  error: {
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
