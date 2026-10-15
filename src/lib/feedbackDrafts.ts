import { privateStorage } from '@/lib/privateStorage';
import { validFeedbackRequest, type FeedbackRequest } from '@/domain/feedback';
const key = (owner: string) => `pulse.feedback-draft.${owner}`;
const queues = new Map<string, Promise<unknown>>();
function update<T>(owner: string, work: () => Promise<T>) {
  const result = (queues.get(owner) ?? Promise.resolve()).then(work);
  const settled = result.catch(() => undefined);
  queues.set(owner, settled);
  void settled.finally(() => {
    if (queues.get(owner) === settled) queues.delete(owner);
  });
  return result;
}
export async function readFeedbackDraft(owner: string) {
  await queues.get(owner);
  const raw = await privateStorage.getItem(key(owner));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (validFeedbackRequest(value)) return value;
  } catch {
    /* Preserve an unreadable draft instead of replacing it silently. */
  }
  throw new Error(
    'Your saved feedback draft could not be read. Contact support before submitting another message.',
  );
}
export function saveFeedbackDraft(owner: string, request: FeedbackRequest) {
  if (!validFeedbackRequest(request))
    return Promise.reject(
      new Error('Enter 10–2,000 characters before sending.'),
    );
  return update(owner, async () => {
    const raw = await privateStorage.getItem(key(owner));
    if (raw) {
      let existing: unknown;
      try {
        existing = JSON.parse(raw);
      } catch {
        throw new Error(
          'Your saved feedback draft could not be read. Retry loading it before sending.',
        );
      }
      if (!validFeedbackRequest(existing))
        throw new Error(
          'Your saved feedback draft could not be read. Retry loading it before sending.',
        );
      if (existing.id !== request.id)
        throw new Error(
          'An earlier feedback send needs confirmation. Close this form and resume the saved ticket.',
        );
      if (JSON.stringify(existing) !== JSON.stringify(request))
        throw new Error(
          'The original feedback details must stay unchanged while its send is unresolved.',
        );
    }
    await privateStorage.setItem(key(owner), JSON.stringify(request));
  });
}
export function clearFeedbackDraft(owner: string, expectedId?: string) {
  return update(owner, async () => {
    if (expectedId) {
      const raw = await privateStorage.getItem(key(owner));
      if (raw) {
        try {
          if (JSON.parse(raw).id !== expectedId) return false;
        } catch {
          return false;
        }
      }
    }
    await privateStorage.removeItem(key(owner));
    return true;
  });
}
