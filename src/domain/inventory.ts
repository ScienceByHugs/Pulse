import type { TodayItem, InventorySummary } from '@/services/pulse';
import {
  occurrencesForDay,
  deviceTimeZone,
  zonedDateKey,
  wallTimeToInstant,
} from './occurrences';
export function usableContainers(item: TodayItem, now = new Date()) {
  return (item.inventory_containers ?? []).filter(
    (c) =>
      c.is_active &&
      c.unit === item.dose_unit &&
      Number.isFinite(Number(c.remaining_amount)) &&
      (!c.expires_at || new Date(c.expires_at).getTime() > now.getTime()) &&
      (!c.user_use_by_at ||
        new Date(c.user_use_by_at).getTime() > now.getTime()),
  );
}
export function preferredContainer(
  item: TodayItem,
  now = new Date(),
): InventorySummary | null {
  return (
    usableContainers(item, now)
      .filter((c) => Number(c.remaining_amount) >= item.dose_amount)
      .sort(
        (a, b) =>
          Number(Boolean(b.opened_at)) - Number(Boolean(a.opened_at)) ||
          (a.expires_at ?? '9999').localeCompare(b.expires_at ?? '9999') ||
          Number(a.remaining_amount) - Number(b.remaining_amount) ||
          a.id.localeCompare(b.id),
      )[0] ?? null
  );
}
export function supplyEstimate(
  item: TodayItem,
  now = new Date(),
  resolved = new Set<string>(),
) {
  const containers = usableContainers(item, now);
  const remaining = containers.reduce(
    (sum, c) => sum + Number(c.remaining_amount),
    0,
  );
  const entries =
    item.dose_amount > 0
      ? containers.reduce(
          (sum, c) =>
            sum + Math.floor(Number(c.remaining_amount) / item.dose_amount),
          0,
        )
      : 0;
  const low = containers.some(
    (c) => Number(c.remaining_amount) <= Number(c.low_threshold),
  );
  const zone =
    typeof item.schedule.timeZone === 'string' &&
    item.schedule.timeZone !== 'local'
      ? item.schedule.timeZone
      : deviceTimeZone();
  const first = zonedDateKey(now, zone);
  const [y = 0, m = 1, d = 1] = first.split('-').map(Number);
  let lowAt: string | null = low ? first : null;
  const projected = {
    ...item,
    inventory_containers: containers.map((c) => ({
      ...c,
      remaining_amount: Number(c.remaining_amount),
    })),
  };
  for (let offset = 0; offset < 366; offset++) {
    const key = new Date(Date.UTC(y, m - 1, d + offset, 12))
      .toISOString()
      .slice(0, 10);
    for (const event of occurrencesForDay(item, key, zone)) {
      if (resolved.has(event.occurrenceKey)) continue;
      const when = event.scheduledFor
        ? new Date(event.scheduledFor)
        : wallTimeToInstant(key, '23:59', zone)!;
      if (offset === 0 && when < now) continue;
      const chosen = preferredContainer(projected, when);
      if (!chosen)
        return { remaining, entries, until: key, low, lowAt, containers };
      chosen.remaining_amount =
        Number(chosen.remaining_amount) - item.dose_amount;
      if (
        !lowAt &&
        Number(chosen.remaining_amount) <= Number(chosen.low_threshold)
      )
        lowAt = key;
    }
  }
  return { remaining, entries, until: null, low, lowAt, containers };
}
