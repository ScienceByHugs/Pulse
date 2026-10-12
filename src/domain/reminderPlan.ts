import {
  occurrencesForDay,
  deviceTimeZone,
  zonedDateKey,
  wallTimeToInstant,
} from './occurrences';

type ReminderItem = {
  id: string;
  schedule: Record<string, unknown>;
  starts_on?: string | null;
  ends_on?: string | null;
};

export function buildReminderPlan<T extends ReminderItem>(
  items: T[],
  now = new Date(),
  limit = 60,
) {
  const candidates: Array<{ item: T; when: Date; occurrenceKey: string }> = [];
  for (const item of items) {
    const zone =
      typeof item.schedule.timeZone === 'string' &&
      item.schedule.timeZone !== 'local'
        ? item.schedule.timeZone
        : deviceTimeZone();
    const first = zonedDateKey(now, zone);
    const [y = 0, m = 1, d = 1] = first.split('-').map(Number);
    for (let offset = 0; offset < 30; offset++) {
      const key = new Date(Date.UTC(y, m - 1, d + offset, 12))
        .toISOString()
        .slice(0, 10);
      for (const entry of occurrencesForDay(item, key, zone)) {
        const when = entry.scheduledFor
          ? new Date(entry.scheduledFor)
          : wallTimeToInstant(key, '09:00', zone)!;
        if (when > now)
          candidates.push({ item, when, occurrenceKey: entry.occurrenceKey });
      }
    }
  }
  // iOS has a finite pending-notification queue. Keep the nearest events,
  // with room for a manual test; refresh the rolling window when Pulse opens.
  return candidates
    .sort(
      (a, b) =>
        a.when.getTime() - b.when.getTime() ||
        a.item.id.localeCompare(b.item.id),
    )
    .slice(0, limit);
}
