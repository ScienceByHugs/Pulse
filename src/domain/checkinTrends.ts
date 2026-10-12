import type { CheckIn } from '@/services/checkins';
import { localDateKey } from './schedule';
export function checkinTrends(rows: CheckIn[], now = new Date()) {
  const day = (offset: number) =>
    localDateKey(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset),
    );
  const current = rows.filter(
    (r) => r.local_date >= day(6) && r.local_date <= day(0),
  );
  const previous = rows.filter(
    (r) => r.local_date >= day(13) && r.local_date < day(6),
  );
  return (['sleep', 'energy', 'mood'] as const).map((field) => {
    const values = current
      .map((r) => r[field])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const before = previous
      .map((r) => r[field])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const mean = values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
    const prior = before.length
      ? before.reduce((a, b) => a + b, 0) / before.length
      : null;
    return {
      field,
      mean,
      count: values.length,
      previousCount: before.length,
      delta:
        values.length >= 2 &&
        before.length >= 2 &&
        mean !== null &&
        prior !== null
          ? mean - prior
          : null,
    };
  });
}
