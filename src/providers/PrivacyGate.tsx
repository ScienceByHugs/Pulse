import { PulseBrand } from '@/components/PulseBrand';
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { getBiometricLockEnabled } from '@/lib/privacy';
import { colors, radius, spacing, typography } from '@/theme';

export function PrivacyGate({ children }: PropsWithChildren) {
  const [locked, setLocked] = useState(true);
  const [checking, setChecking] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const authInFlight = useRef(false);
  const backgrounded = useRef(false);
  const mounted = useRef(true);

  const authenticate = useCallback(async () => {
    // The iOS Face ID system sheet can trigger inactive -> active transitions.
    // Never start another prompt while one is already in progress.
    if (authInFlight.current) return;
    authInFlight.current = true;
    setChecking(true);
    setErrorText(null);

    try {
      if (Platform.OS === 'web' || !(await getBiometricLockEnabled())) {
        if (mounted.current) setLocked(false);
        return;
      }
      if (mounted.current) setLocked(true);
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled =
        hardware && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) {
        if (mounted.current)
          setErrorText(
            'Face ID or device biometrics are not available. Check your device settings.',
          );
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Pulse',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (!mounted.current) return;
      setLocked(!result.success);
      if (!result.success)
        setErrorText('Pulse remains locked. Try again to unlock.');
    } catch {
      if (mounted.current) {
        setLocked(true);
        setErrorText('Could not verify your identity. Try again.');
      }
    } finally {
      authInFlight.current = false;
      if (mounted.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void authenticate();
    const subscription = AppState.addEventListener('change', (state) => {
      // Do not mistake the biometric system overlay for the app entering background.
      if (state === 'background') {
        backgrounded.current = true;
        setLocked(true);
      } else if (state === 'active' && backgrounded.current) {
        backgrounded.current = false;
        if (!authInFlight.current) void authenticate();
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [authenticate]);

  if (!locked && !checking) return children;

  return (
    <View style={styles.page}>
      <PulseBrand />
      <Text style={styles.title}>
        {checking ? 'Securing Pulse…' : 'Pulse is locked'}
      </Text>
      {errorText ? <Text style={styles.explanation}>{errorText}</Text> : null}
      {!checking ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Unlock Pulse"
          style={styles.button}
          onPress={() => void authenticate()}
        >
          <Text style={styles.buttonText}>UNLOCK</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  brand: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 5,
  },
  title: { ...typography.sectionTitle, color: colors.text, marginTop: 12 },
  explanation: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 12,
  },
  button: {
    marginTop: 24,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  buttonText: { ...typography.button, color: '#03111f' },
});
