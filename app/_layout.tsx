import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { SyncProvider } from '@/providers/SyncProvider';
import '@/lib/reminders';
import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { AuthProvider } from '@/providers/AuthProvider';
import { PrivacyGate } from '@/providers/PrivacyGate';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

function VerifiedRoutes() {
  const { session } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!session || Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      if (typeof data?.protocolItemId === 'string') {
        router.push({
          pathname: '/(tabs)',
          params: {
            item: data.protocolItemId,
            occurrence:
              typeof data.occurrenceKey === 'string' ? data.occurrenceKey : '',
          },
        });
        void Notifications.clearLastNotificationResponseAsync();
      }
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const listener =
      Notifications.addNotificationResponseReceivedListener(open);
    return () => listener.remove();
  }, [session?.user.id, router]);
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="auth/reset-password" />
      <Stack.Protected guard={Boolean(session)} redirectTo="/sign-in">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="about" />
        <Stack.Screen name="feedback" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SyncProvider>
        <PrivacyGate>
          <StatusBar barStyle="light-content" />
          <VerifiedRoutes />
        </PrivacyGate>
      </SyncProvider>
    </AuthProvider>
  );
}
