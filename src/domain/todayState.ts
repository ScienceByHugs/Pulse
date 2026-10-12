import { localDayRange } from './schedule';
import { trackingId } from './occurrences';
import type { TimelineEntry, TodayItem } from '@/services/pulse';
export function todayRecordState(
  items: Array<TodayItem & { occurrenceKey?: string }>,
  logs: TimelineEntry[],
  now = new Date(),
) {
  const { start, end } = localDayRange(now);
  const completedIds = new Set<string>();
  const skippedIds = new Set<string>();
  for (const log of logs) {
    if (!log.protocol_item_id || !['completed', 'skipped'].includes(log.status))
      continue;
    let match = items.find(
      (i) => i.occurrenceKey === log.occurrence_key && Boolean(i.occurrenceKey),
    );
    if (!match && !log.occurrence_key) {
      const time = new Date(log.logged_at);
      if (time < start || time >= end) continue;
      const candidates = items.filter((i) => i.id === log.protocol_item_id);
      match =
        candidates.length === 1
          ? candidates[0]
          : candidates.find(
              (i) =>
                !completedIds.has(trackingId(i)) &&
                !skippedIds.has(trackingId(i)),
            );
    }
    if (!match) continue;
    const key = trackingId(match);
    (log.status === 'completed' ? completedIds : skippedIds).add(key);
  }
  for (const id of completedIds) skippedIds.delete(id);
  const resolvedIds = new Set([...completedIds, ...skippedIds]);
  const completed = completedIds.size,
    skipped = skippedIds.size;
  return {
    completedIds,
    skippedIds,
    resolvedIds,
    completed,
    skipped,
    due: items.length,
    percent: items.length ? Math.round((completed / items.length) * 100) : 100,
  };
}
