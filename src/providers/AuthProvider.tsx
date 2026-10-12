import { isNetworkError } from '@/domain/network';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { disableReminders } from '@/lib/reminders';
import * as Notifications from 'expo-notifications';
import { updatePulseTodayWidget } from '@/lib/widgets';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
});

function paramsFromUrl(url: string) {
  const merged = [url.split('?')[1]?.split('#')[0], url.split('#')[1]]
    .filter(Boolean)
    .join('&');
  return new URLSearchParams(merged);
}

async function consumeAuthUrl(url: string) {
  const params = paramsFromUrl(url);
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (
    tokenHash &&
    (type === 'recovery' || type === 'email' || type === 'signup')
  ) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) throw error;
    return;
  }
  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let verificationVersion = 0;
    let previousUserId: string | null = null;

    async function clearDevicePreviews() {
      await disableReminders();
      if (Platform.OS !== 'web')
        await Notifications.dismissAllNotificationsAsync();
      await updatePulseTodayWidget(0, 'Open Pulse');
    }

    // A Supabase session alone does NOT grant access to Pulse. Check the
    // current user with the Auth server and fail closed until confirmed.
    async function validateSession(candidate: Session | null) {
      const version = ++verificationVersion;
      if (!mounted) return;

      if (!candidate) {
        previousUserId = null;
        setSession(null);
        setLoading(false);
        void clearDevicePreviews().catch(() => undefined);
        return;
      }

      if (previousUserId !== candidate.user.id) {
        setSession(null);
        setLoading(true);
      }
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!mounted || version !== verificationVersion) return;
        const user = data.user;
        if (
          !error &&
          user?.id === candidate.user.id &&
          Boolean(user.email_confirmed_at)
        ) {
          previousUserId = user.id;
          setSession({ ...candidate, user });
        } else if (isNetworkError(error) && candidate.user.email_confirmed_at) {
          previousUserId = candidate.user.id;
          setSession(candidate);
        } else {
          setSession(null);
          // Remove unverified sessions (including ones minted while Supabase
          // confirmation was disabled), preventing persistent app sessions.
          if (
            !error &&
            user?.id === candidate.user.id &&
            !user.email_confirmed_at
          ) {
            void supabase.auth.signOut();
          }
        }
      } catch (error) {
        if (!mounted || version !== verificationVersion) return;
        setSession(
          isNetworkError(error) && candidate.user.email_confirmed_at
            ? candidate
            : null,
        );
      } finally {
        if (mounted && version === verificationVersion) setLoading(false);
      }
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => validateSession(data.session))
      .catch(() => {
        if (mounted) {
          setSession(null);
          setLoading(false);
        }
      });

    void Linking.getInitialURL().then((url) => {
      if (url?.startsWith('pulse://auth/'))
        void consumeAuthUrl(url).catch(() => undefined);
    });

    const linkListener = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('pulse://auth/'))
        void consumeAuthUrl(url).catch(() => undefined);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        // Supabase auth calls must not execute inside onAuthStateChange.
        setTimeout(() => {
          if (mounted) void validateSession(nextSession);
        }, 0);
      },
    );

    if (Platform.OS !== 'web' && AppState.currentState === 'active')
      supabase.auth.startAutoRefresh();
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (Platform.OS === 'web') return;
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    return () => {
      mounted = false;
      verificationVersion++;
      linkListener.remove();
      appStateListener.remove();
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh();
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, loading }), [session, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
