import '@/lib/reminders';
import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { AuthProvider } from '@/providers/AuthProvider';
import { PrivacyGate } from '@/providers/PrivacyGate';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

function VerifiedRoutes() {
  const { session } = useAuth();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="auth/reset-password" />
      <Stack.Protected guard={Boolean(session)} redirectTo="/sign-in">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="about" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PrivacyGate>
        <StatusBar barStyle="light-content" />
        <VerifiedRoutes />
      </PrivacyGate>
    </AuthProvider>
  );
}
