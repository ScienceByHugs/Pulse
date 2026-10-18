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
import { AUTH_LINK_ERROR, createAuthLinkConsumer, isAuthUrl } from '@/lib/authLinks';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  authLinkError: string | null;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  authLinkError: null,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkPending, setLinkPending] = useState(true);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let verificationVersion = 0;
    let previousUserId: string | null = null;
    let linkVersion = 0;
    const consumeAuthUrl = createAuthLinkConsumer(supabase.auth);

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

    async function handleAuthUrl(url: string) {
      const version = ++linkVersion;
      if (mounted) {
        setLinkPending(true);
        setAuthLinkError(null);
      }
      try {
        const candidate = await consumeAuthUrl(url);
        if (mounted && version === linkVersion) await validateSession(candidate);
      } catch {
        if (mounted && version === linkVersion) {
          setAuthLinkError(AUTH_LINK_ERROR);
          setLoading(false);
        }
      } finally {
        if (mounted && version === linkVersion) setLinkPending(false);
      }
    }

    const linkListener = Linking.addEventListener('url', ({ url }) => {
      if (isAuthUrl(url)) void handleAuthUrl(url);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        // Supabase auth calls must not execute inside onAuthStateChange.
        setTimeout(() => {
          if (mounted) void validateSession(nextSession);
        }, 0);
      },
    );

    // Resolve the initial URL before declaring startup finished. Explicitly
    // validate the returned session instead of relying only on auth events.
    const initialLinkVersion = linkVersion;
    void (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!mounted || initialLinkVersion !== linkVersion) return;
        if (url && isAuthUrl(url)) {
          await handleAuthUrl(url);
        } else {
          const { data } = await supabase.auth.getSession();
          if (mounted && initialLinkVersion === linkVersion)
            await validateSession(data.session);
        }
      } catch {
        if (mounted && initialLinkVersion === linkVersion) setLoading(false);
      } finally {
        if (mounted && initialLinkVersion === linkVersion) setLinkPending(false);
      }
    })();

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
      linkVersion++;
      linkListener.remove();
      appStateListener.remove();
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh();
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ session, loading: loading || linkPending, authLinkError }),
    [session, loading, linkPending, authLinkError],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
