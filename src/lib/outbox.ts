import AsyncStorage from '@react-native-async-storage/async-storage';
import { privateStorage } from '@/lib/privateStorage';

const LEGACY_KEY = 'pulse.quick_log_outbox.v1';
const storageKey = (userId: string) => {
  if (!userId) throw new Error('Sign in before saving offline records.');
  return `pulse.quick_log_outbox.v2.${userId}`;
};
let pending: Promise<unknown> = Promise.resolve();
function serialize<T>(action: () => Promise<T>): Promise<T> {
  const result = pending.then(action);
  pending = result.catch(() => undefined);
  return result;
}

export type QuickLogPayload = {
  protocolItemId: string;
  amount: number;
  unit: string;
  route?: string | null;
  site?: string | null;
  inventoryContainerId?: string | null;
  scheduledFor?: string | null;
  clientEventId: string;
};

export async function readOutbox(userId: string): Promise<QuickLogPayload[]> {
  // Legacy queues have no owner. Never guess the account or replay them.
  // Preserve them for explicit recovery rather than silently discarding records.
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy !== null) {
    await privateStorage.setItem('pulse.quick_log_outbox.unassigned', legacy);
    await AsyncStorage.removeItem(LEGACY_KEY);
  }
  const raw = await privateStorage.getItem(storageKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function enqueueQuickLog(userId: string, payload: QuickLogPayload) {
  return serialize(async () => {
    const current = await readOutbox(userId);
    if (current.some((item) => item.clientEventId === payload.clientEventId)) return;
    await privateStorage.setItem(storageKey(userId), JSON.stringify([...current, payload]));
  });
}

export async function removeQuickLog(userId: string, clientEventId: string) {
  return serialize(async () => {
    const current = await readOutbox(userId);
    await privateStorage.setItem(storageKey(userId), JSON.stringify(current.filter((item) => item.clientEventId !== clientEventId)));
  });
}

export async function clearOutbox(userId: string) {
  return serialize(() => privateStorage.removeItem(storageKey(userId)));
}
