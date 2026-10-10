import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Redirect } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, spacing } from '@/theme';

const AUTH_REDIRECT_URL = 'pulse://auth/callback';

export default function SignInScreen() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/(tabs)" />;

  async function signIn() {
    if (!email || !password) return Alert.alert('Missing information', 'Enter your email and password.');
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message)) {
          Alert.alert('Verify your email first', 'Your account is not yet verified. Open your confirmation email, or use Resend confirmation below.');
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
    const address = email.trim();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(address)) {
      return Alert.alert('Enter your email', 'Enter your account email above to request a password reset.');
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: 'pulse://auth/reset-password' });
      if (error) throw error;
      Alert.alert('Check your email', 'If an account exists for this address, a password reset link will arrive shortly. Open it on this phone.');
    } catch (error) {
      Alert.alert('Could not request reset', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    const address = email.trim();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(address)) {
      return Alert.alert('Enter your email', 'Enter the address you used to register.');
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: address,
        options: { emailRedirectTo: AUTH_REDIRECT_URL }
      });
      if (error) throw error;
      Alert.alert('Check your inbox', 'If your address still needs verification, another confirmation email will arrive shortly. Check spam too.');
    } catch (error) {
      Alert.alert('Could not resend email', error instanceof Error ? error.message : 'Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  async function signUp() {
    const address = email.trim();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(address) || password.length < 8) {
      return Alert.alert('Check your details', 'Use a valid email and a password with at least 8 characters.');
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo: AUTH_REDIRECT_URL }
      });
      if (error) throw error;

      if (data.session) {
        // A session at signup means Supabase is automatically confirming email.
        // Do not silently let the registration flow enter the app.
        await supabase.auth.signOut();
        Alert.alert('Verification configuration required', 'Pulse requires email verification. The server returned a session before confirmation. Please contact support.');
        return;
      }

      Alert.alert('Confirm your email', 'We sent a confirmation link. Verify your email before signing in to Pulse.');
    } catch (error) {
      Alert.alert('Could not create account', error instanceof Error ? error.message : 'Try again later.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <Text style={styles.eyebrow}>SCIENCE BY HUGS</Text>
        <Text style={styles.logo}>PULSE</Text>
        <Text style={styles.title}>Your routine, in one place.</Text>
        <Text style={styles.subtitle}>Private protocol tracking, inventory, reminders and history.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />
          <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={signIn}>
            <Text style={styles.primaryText}>{busy ? 'WORKING…' : 'SIGN IN'}</Text>
          </Pressable>
          <Pressable style={styles.secondary} disabled={busy} onPress={() => void resetPassword()}><Text style={styles.secondaryText}>Forgot password?</Text></Pressable>
          <Pressable style={styles.secondary} disabled={busy} onPress={() => void resendConfirmation()}><Text style={styles.secondaryText}>Resend confirmation email</Text></Pressable>
          <Pressable style={styles.secondary} disabled={busy} onPress={signUp}>
            <Text style={styles.secondaryText}>Create a Pulse account</Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>Pulse organizes information you enter. It does not diagnose, prescribe, or recommend treatment or dosage.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  eyebrow: { color: colors.muted, fontSize: 10, letterSpacing: 2.4, fontWeight: '800' },
  logo: { color: colors.text, fontSize: 38, letterSpacing: 8, fontWeight: '900', marginTop: 4 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -1, marginTop: 34 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 420 },
  form: { gap: 12, marginTop: 30 },
  input: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 15, color: colors.text, fontSize: 16 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#03111f', fontWeight: '900', letterSpacing: 1.1 },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: colors.accent, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 28 }
});
