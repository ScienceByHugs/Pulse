import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
} from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing, typography } from '@/theme';

export default function AuthCallbackScreen() {
  const { session, loading } = useAuth();

  if (session) return <Redirect href="/(tabs)" />;
  if (!loading) return <Redirect href="/sign-in" />;

  return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.text}>Finishing sign in…</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  text: { ...typography.body, color: colors.muted },
});
