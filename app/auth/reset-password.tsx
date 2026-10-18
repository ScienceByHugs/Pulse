import { type ComponentRef, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { session, loading, authLinkError } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [completed, setCompleted] = useState(false);
  const confirmationInput = useRef<ComponentRef<typeof TextInput>>(null);
  const updating = useRef(false);

  async function updatePassword() {
    if (updating.current || loading) return;
    if (!session || authLinkError)
      return Alert.alert(
        'Link not ready',
        'Open the latest password reset email link again.',
      );
    if (password.length < 8)
      return Alert.alert('Weak password', 'Use at least 8 characters.');
    if (password !== confirmation)
      return Alert.alert('Passwords differ', 'Make sure both passwords match.');
    updating.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirmation('');
      Keyboard.dismiss();
      setCompleted(true);
    } catch (error) {
      Alert.alert(
        'Could not update password',
        error instanceof Error ? error.message : 'Try requesting a new link.',
      );
    } finally {
      updating.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.content}
        >
          <Text style={styles.kicker}>ACCOUNT SECURITY</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {completed ? 'Password updated' : 'Reset password'}
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.description}>
            {completed
              ? 'Your new password has been saved. Use it the next time you sign in.'
              : loading
                ? 'Verifying your reset link…'
                : authLinkError
                  ? authLinkError
                  : session
                  ? 'Choose a new password with at least 8 characters.'
                  : 'Your reset link could not be verified. Return to sign-in to request a new one.'}
          </Text>
          {completed ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/(tabs)')}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Continue to Pulse</Text>
            </Pressable>
          ) : session && !loading && !authLinkError ? (
            <>
              <View style={styles.labelRow}>
                <Text style={styles.label}>New password</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? 'Hide passwords' : 'Show passwords'
                  }
                  disabled={busy}
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.reveal}
                >
                  <Text style={styles.backText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                accessibilityLabel="New password"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmationInput.current?.focus()}
              />
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                ref={confirmationInput}
                accessibilityLabel="Confirm new password"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Enter your password again"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={confirmation}
                onChangeText={setConfirmation}
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={() => void updatePassword()}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => void updatePassword()}
                style={[styles.button, busy && styles.disabled]}
              >
                <Text style={styles.buttonText}>
                  {busy ? 'Updating…' : 'Update password'}
                </Text>
              </Pressable>
            </>
          ) : null}
          {!completed && (
            <Pressable
              accessibilityRole="button"
              disabled={busy || loading}
              onPress={() => router.replace(session ? '/(tabs)' : '/sign-in')}
              style={[styles.back, (busy || loading) && styles.disabled]}
            >
              <Text style={styles.backText}>
                {session ? 'Cancel' : 'Back to sign in'}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  kicker: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.pageTitle, color: colors.text },
  description: { ...typography.body, color: colors.muted },
  label: { ...typography.label, color: colors.text },
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  input: {
    ...typography.input,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    padding: 14,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: 16,
    minHeight: 48,
    alignItems: 'center',
  },
  buttonText: { color: colors.bg, fontWeight: '800' },
  reveal: {
    minHeight: 44,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { minHeight: 44, paddingVertical: 12, alignItems: 'center' },
  backText: { color: colors.accent, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});
