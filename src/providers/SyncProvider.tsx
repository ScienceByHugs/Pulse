import { deviceTimeZone, zonedDateKey } from '@/domain/occurrences';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from './AuthProvider';
import { flushQuickLogOutbox } from '@/services/pulse';
import { readOutbox, type QuickLogPayload } from '@/lib/outbox';
import { privateStorage } from '@/lib/privateStorage';
const Context = createContext({
  pending: [] as QuickLogPayload[],
  syncing: false,
  revision: 0,
  online: true,
  refresh: async (_retry = false) => {},
});
export function SyncProvider({ children }: PropsWithChildren) {
  const signature = useRef('');
  const { session } = useAuth();
  const uid = session?.user.id;
  const owner = useRef(uid);
  owner.current = uid;
  const [pending, setPending] = useState<QuickLogPayload[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(
    async (retry = false) => {
      if (!uid) {
        setPending([]);
        return;
      }
      setSyncing(true);
      try {
        const flushed = await flushQuickLogOutbox(retry);
        const {
          data: { session: current },
        } = await (await import('@/lib/supabase')).supabase.auth.getSession();
        if (current?.user.id === uid) {
          const records = await readOutbox(uid);
          if (owner.current === uid) {
            setPending(records);
            if (flushed) setRevision((n) => n + 1);
          }
        }
      } finally {
        if (owner.current === uid) setSyncing(false);
      }
    },
    [uid],
  );
  useEffect(() => {
    let active = true;
    setPending([]);
    if (!uid) return;
    signature.current =
      deviceTimeZone() + ':' + zonedDateKey(new Date(), deviceTimeZone());
    void readOutbox(uid)
      .then((records) => {
        if (active && owner.current === uid) setPending(records);
      })
      .catch(() => undefined);
    const unsub = NetInfo.addEventListener((state) => {
      if (!active) return;
      const connected =
        state.isConnected !== false && state.isInternetReachable !== false;
      setOnline(connected);
      if (connected) {
        setRevision((n) => n + 1);
        void refresh().catch(() => undefined);
      }
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setRevision((n) => n + 1);
        void refresh().catch(() => undefined);
      }
    });
    const timer = setInterval(() => {
      const current =
        deviceTimeZone() + ':' + zonedDateKey(new Date(), deviceTimeZone());
      if (signature.current !== current) {
        signature.current = current;
        setRevision((n) => n + 1);
      }
      void refresh().catch(() => undefined);
    }, 60000);
    return () => {
      active = false;
      unsub();
      app.remove();
      clearInterval(timer);
    };
  }, [uid, refresh]);
  return (
    <Context.Provider value={{ pending, syncing, online, revision, refresh }}>
      {children}
    </Context.Provider>
  );
}
export const useSync = () => useContext(Context);
export async function cacheToday(userId: string, data: unknown) {
  await privateStorage.setItem(
    `pulse.today-cache.${userId}`,
    JSON.stringify(data),
  );
}
export async function cachedToday(userId: string) {
  const raw = await privateStorage.getItem(`pulse.today-cache.${userId}`);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
