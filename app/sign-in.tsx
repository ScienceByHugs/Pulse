import { FormSheet } from '@/components/FormSheet';
import { isValidEmail } from '@/domain/validation';
import { authEmailErrorMessage } from '@/domain/authEmail';
import { authEmailGate } from '@/lib/authEmail';
import { useAuthEmailCooldown } from '@/hooks/useAuthEmailCooldown';
import { OrbitalBackground } from '@/components/OrbitalBackground';
import { PulseBrand } from '@/components/PulseBrand';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type ComponentRef, useRef, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, spacing, typography } from '@/theme';

const AUTH_REDIRECT_URL = 'pulse://auth/callback';

export default function SignInScreen() {
  const { session } = useAuth();
  const emailWaitSeconds = useAuthEmailCooldown();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'signup' | 'reset' | 'verify' | null>(
    null,
  );
  const [sheetEmail, setSheetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [adultUS, setAdultUS] = useState(false);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const newPasswordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmPasswordInput = useRef<ComponentRef<typeof TextInput>>(null);

  function openSheet(mode: 'signup' | 'reset' | 'verify') {
    setSheetEmail(email.trim());
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setNotice('');
    setAdultUS(false);
    setSheet(mode);
  }
  function closeSheet() {
    if (busy) return;
    setSheet(null);
    setNewPassword('');
    setConfirmPassword('');
    setNotice('');
  }

  if (session) return <Redirect href="/(tabs)" />;

  async function signIn() {
    if (busy) return;
    if (!isValidEmail(email.trim()) || !password)
      return Alert.alert(
        'Check your details',
        'Enter a valid email address and your password.',
      );
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        if (
          error.code === 'email_not_confirmed' ||
          /email not confirmed/i.test(error.message)
        ) {
          Alert.alert(
            'Verify your email first',
            'Open the confirmation email to verify your account.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Resend email', onPress: () => openSheet('verify') },
            ],
          );
        } else {
          Alert.alert('Could not sign in', error.message);
        }
      }
    } catch {
      Alert.alert('Could not sign in', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (busy) return;
    const address = sheetEmail.trim();
    if (!isValidEmail(address)) {
      return Alert.alert(
        'Enter your email',
        'Enter your account email to request a password reset.',
      );
    }
    setBusy(true);
    try {
      await authEmailGate.run(() => supabase.auth.resetPasswordForEmail(address, {
        redirectTo: 'pulse://auth/reset-password',
      }));
      setNotice(
        'If an account exists for this address, a reset link will arrive shortly. Open it on this phone.',
      );
    } catch (error) {
      Alert.alert(
        'Could not request reset',
        authEmailErrorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (busy) return;
    const address = sheetEmail.trim();
    if (!isValidEmail(address)) {
      return Alert.alert(
        'Enter your email',
        'Enter the address you used to register.',
      );
    }
    setBusy(true);
    try {
      await authEmailGate.run(() => supabase.auth.resend({
        type: 'signup',
        email: address,
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
      }));
      setNotice(
        'If your address still needs verification, a confirmation email will arrive shortly. Check spam too.',
      );
    } catch (error) {
      Alert.alert(
        'Could not resend email',
        authEmailErrorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function signUp() {
    if (busy) return;
    if (!adultUS)
      return Alert.alert(
        'Eligibility confirmation required',
        'Pulse is for adults 18 or older residing in the United States.',
      );
    const address = sheetEmail.trim();
    if (!isValidEmail(address) || newPassword.length < 8) {
      return Alert.alert(
        'Check your details',
        'Use a valid email and a password with at least 8 characters.',
      );
    }
    if (newPassword !== confirmPassword)
      return Alert.alert(
        'Passwords do not match',
        'Enter the same password in both fields.',
      );
    setBusy(true);
    try {
      const { data } = await authEmailGate.run(() => supabase.auth.signUp({
        email: address,
        password: newPassword,
        options: {
          emailRedirectTo: AUTH_REDIRECT_URL,
          data: {
            eligibility_confirmation: {
              age18Plus: true,
              usResident: true,
              confirmedAt: new Date().toISOString(),
            },
          },
        },
      }));

      if (data?.session) {
        // A session at signup means Supabase is automatically confirming email.
        // Do not silently let the registration flow enter the app.
        await supabase.auth.signOut();
        Alert.alert(
          'Verification configuration required',
          'Pulse requires email verification. The server returned a session before confirmation. Please contact support.',
        );
        return;
      }

      setEmail(address);
      setNewPassword('');
      setConfirmPassword('');
      setNotice(
        'Check your inbox for a confirmation link. Verify your email, then return here to sign in. If you already have an account, try signing in or resetting your password.',
      );
    } catch (error) {
      Alert.alert(
        'Could not create account',
        authEmailErrorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <OrbitalBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <PulseBrand />
          <Text style={styles.eyebrow}>WELCOME TO PULSE</Text>
          <Text style={styles.title}>Sign in to your account</Text>
          <Text style={styles.subtitle}>
            Your routines, records and reminders, together.
          </Text>
          <View style={styles.form}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              accessibilityLabel="Email address"
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              editable={!busy}
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordInput.current?.focus()}
            />
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => openSheet('reset')}
                style={styles.inlineAction}
              >
                <Text style={styles.secondaryText}>Forgot password?</Text>
              </Pressable>
            </View>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordInput}
                accessibilityLabel="Password"
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={() => {
                  if (!busy) void signIn();
                }}
                returnKeyType="go"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? 'Hide password' : 'Show password'
                }
                onPress={() => setShowPassword(!showPassword)}
                disabled={busy}
                style={styles.reveal}
              >
                <Text style={styles.secondaryText}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
              style={[styles.primary, busy && styles.disabled]}
              disabled={busy}
              onPress={signIn}
            >
              <Text style={styles.primaryText}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.newAccount}>
            <Text style={styles.subtitle}>New to Pulse?</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => openSheet('signup')}
              style={styles.outline}
            >
              <Text style={styles.secondaryText}>Create an account</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            style={styles.secondary}
            disabled={busy}
            onPress={() => openSheet('verify')}
          >
            <Text style={styles.helpText}>Need to verify your email?</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={styles.secondary}
            disabled={busy}
            onPress={() => router.push('/legal')}
          >
            <Text style={styles.secondaryText}>
              Privacy, terms & health information
            </Text>
          </Pressable>
          <Text style={styles.disclaimer}>
            Pulse records the routine you enter. It does not diagnose,
            prescribe, or establish whether a peptide or medication is safe.
            Check with a qualified clinician before making medical decisions.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <FormSheet
        label={sheet === 'signup' ? 'New account' : 'Account help'}
        visible={sheet !== null}
        onClose={closeSheet}
        busy={busy}
        contentKey={sheet ?? 'closed'}
      >
        <Text style={styles.title}>
          {sheet === 'signup'
            ? 'Create your Pulse account'
            : sheet === 'reset'
              ? 'Reset your password'
              : 'Verify your email'}
        </Text>
        <Text style={styles.subtitle}>
          {sheet === 'signup'
            ? 'Use your email and choose a password. You’ll verify your email before signing in.'
            : sheet === 'reset'
              ? 'We’ll email you a link to choose a new password.'
              : 'Enter the email you used to create your account.'}
        </Text>
        {notice ? (
          <View style={styles.form}>
            <Text accessibilityRole="header" style={styles.label}>
              Check your inbox
            </Text>
            <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
              {notice}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.primary}
              onPress={closeSheet}
            >
              <Text style={styles.primaryText}>Back to sign in</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              accessibilityLabel="Account email address"
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              editable={!busy}
              value={sheetEmail}
              onChangeText={setSheetEmail}
              returnKeyType={sheet === 'signup' ? 'next' : 'send'}
              submitBehavior="submit"
              onSubmitEditing={() => {
                if (sheet === 'signup') newPasswordInput.current?.focus();
                else if (sheet === 'reset') void resetPassword();
                else if (sheet === 'verify') void resendConfirmation();
              }}
            />
            {sheet === 'signup' && (
              <>
                <Text style={styles.label}>Choose a password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    ref={newPasswordInput}
                    accessibilityLabel="Choose a password"
                    style={[styles.input, styles.passwordInput]}
                    placeholder="At least 8 characters"
                    placeholderTextColor={colors.muted}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    editable={!busy}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() =>
                      confirmPasswordInput.current?.focus()
                    }
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showNewPassword
                        ? 'Hide new passwords'
                        : 'Show new passwords'
                    }
                    style={styles.reveal}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    disabled={busy}
                  >
                    <Text style={styles.secondaryText}>
                      {showNewPassword ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  ref={confirmPasswordInput}
                  accessibilityLabel="Confirm password"
                  style={styles.input}
                  placeholder="Enter your password again"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  editable={!busy}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  returnKeyType="done"
                />
              </>
            )}
            {sheet === 'signup' && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="I am 18 or older and reside in the United States"
                aria-checked={adultUS}
                accessibilityState={{ checked: adultUS, disabled: busy }}
                disabled={busy}
                onPress={() => setAdultUS((v) => !v)}
                style={{
                  minHeight: 48,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <Text style={{ color: colors.accent, fontSize: 20 }}>
                  {adultUS ? '☑' : '☐'}
                </Text>
                <Text style={[styles.subtitle, { flex: 1, marginTop: 0 }]}>
                  I am 18 or older and reside in the United States.
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: busy || emailWaitSeconds > 0 || (sheet === 'signup' && !adultUS),
                busy,
              }}
              disabled={busy || emailWaitSeconds > 0 || (sheet === 'signup' && !adultUS)}
              style={[
                styles.primary,
                (busy || emailWaitSeconds > 0 || (sheet === 'signup' && !adultUS)) && styles.disabled,
              ]}
              onPress={() =>
                void (sheet === 'signup'
                  ? signUp()
                  : sheet === 'reset'
                    ? resetPassword()
                    : resendConfirmation())
              }
            >
              <Text style={styles.primaryText}>
                {busy
                  ? 'Please wait…'
                  : emailWaitSeconds > 0
                    ? `Try again in ${emailWaitSeconds}s`
                    : sheet === 'signup'
                    ? 'Create account'
                    : sheet === 'reset'
                      ? 'Send reset link'
                      : 'Resend confirmation email'}
              </Text>
            </Pressable>
            {sheet === 'signup' && (
              <Pressable
                accessibilityRole="button"
                style={styles.secondary}
                onPress={() => {
                  closeSheet();
                  router.push('/legal');
                }}
                disabled={busy}
              >
                <Text style={styles.helpText}>
                  Read privacy & health information
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </FormSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  page: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginTop: spacing.xl,
  },
  sheetPage: {
    padding: spacing.lg,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  label: { ...typography.label, color: colors.text },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineAction: { minHeight: 44, justifyContent: 'center' },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  reveal: {
    minHeight: 48,
    minWidth: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  newAccount: { marginTop: 24, gap: 12, alignItems: 'center' },
  outline: {
    width: '100%',
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: { ...typography.detail, color: colors.muted },
  logo: {
    color: colors.text,
    fontSize: 38,
    letterSpacing: -0.4,
    fontWeight: '900',
    marginTop: 4,
  },
  title: { ...typography.pageTitle, color: colors.text, marginTop: 34 },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    marginTop: 8,
    maxWidth: 420,
  },
  form: { gap: 12, marginTop: 30 },
  input: {
    ...typography.input,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: colors.text,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { ...typography.button, color: '#03111f' },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { ...typography.button, color: colors.accent },
  disabled: { opacity: 0.55 },
  disclaimer: { ...typography.caption, color: colors.muted, marginTop: 28 },
});
