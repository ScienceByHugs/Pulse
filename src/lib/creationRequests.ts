import { randomUUID } from 'expo-crypto';
import { privateStorage } from '@/lib/privateStorage';
export function stableCreationValue(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(stableCreationValue).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableCreationValue(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
type Request = {
  kind: string;
  signature: string;
  id: string;
  containerId: string;
};
const key = (userId: string) => `pulse.creations.${userId}`;
export async function pendingCreations(userId: string): Promise<Request[]> {
  const raw = await privateStorage.getItem(key(userId));
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (!Array.isArray(value))
    throw new Error(
      'Creation recovery data needs review. Contact support before creating another item.',
    );
  return value;
}
export const clearCreations = (userId: string) =>
  privateStorage.removeItem(key(userId));
let serial: Promise<unknown> = Promise.resolve();
const inFlight = new Map<string, Promise<unknown>>();
export function withCreation<T>(
  userId: string,
  kind: string,
  payload: unknown,
  work: (request: Request) => Promise<T>,
): Promise<T> {
  const signature = stableCreationValue(payload);
  const activeKey = `${userId}:${kind}:${signature}`;
  const existing = inFlight.get(activeKey);
  if (existing) return existing as Promise<T>;
  const run = serial.then(async () => {
    const requests = await pendingCreations(userId);
    let request = requests.find(
      (r) => r.kind === kind && r.signature === signature,
    );
    if (!request) {
      if (requests.length >= 50)
        throw new Error(
          'Several creations are still unconfirmed. Refresh your records and contact support before adding more.',
        );
      request = {
        kind,
        signature,
        id: randomUUID(),
        containerId: randomUUID(),
      };
      await privateStorage.setItem(
        key(userId),
        JSON.stringify([...requests, request]),
      );
    }
    const result = await work(request);
    // Clear only after every part is confirmed; interruption safely reuses IDs.
    await privateStorage.setItem(
      key(userId),
      JSON.stringify(
        (await pendingCreations(userId)).filter((r) => r.id !== request.id),
      ),
    );
    return result;
  });
  const result = run.finally(() => inFlight.delete(activeKey));
  inFlight.set(activeKey, result);
  serial = result.catch(() => undefined);
  return result;
}
