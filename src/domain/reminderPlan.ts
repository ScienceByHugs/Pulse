import { isDueOnDate, localDateKey, scheduleTime } from './schedule';

type ReminderItem = {
  id: string;
  schedule: Record<string, unknown>;
  starts_on?: string | null;
  ends_on?: string | null;
};

export function buildReminderPlan<T extends ReminderItem>(items: T[], now = new Date(), limit = 60) {
  const candidates: Array<{ item: T; when: Date }> = [];
  for (let offset = 0; offset < 30; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const key = localDateKey(day);
    for (const item of items) {
      if ((item.starts_on && key < item.starts_on) || (item.ends_on && key > item.ends_on)) continue;
      if (!isDueOnDate(item.schedule, day)) continue;
      const time = scheduleTime(item.schedule, day) ?? '09:00';
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
      const [hour = 9, minute = 0] = time.split(':').map(Number);
      const when = new Date(day);
      when.setHours(hour, minute, 0, 0);
      if (when > now) candidates.push({ item, when });
    }
  }
  // iOS has a finite pending-notification queue. Keep the nearest events,
  // with room for a manual test; refresh the rolling window when Pulse opens.
  return candidates.sort((a, b) => a.when.getTime() - b.when.getTime() || a.item.id.localeCompare(b.item.id)).slice(0, limit);
}
