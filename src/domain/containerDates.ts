import { localDateKey } from './schedule';

/** Container dates are shown in the device time zone, matching date entry. */
export function containerDateKey(timestamp?: string | null) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? localDateKey(date) : '';
}

export function containerDateTimestamp(
  key: string,
  boundary: 'start' | 'end',
  original?: string | null,
): string | null {
  if (!key) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key))
    throw new Error('Choose a valid container date.');
  // Keep an unchanged date's exact instant, including after a time-zone change.
  if (original && containerDateKey(original) === key) return original;
  const date = new Date(
    `${key}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}`,
  );
  if (!Number.isFinite(date.getTime()) || localDateKey(date) !== key)
    throw new Error('Choose a real container date.');
  return date.toISOString();
}
