import { localDayRange } from './schedule';
import type { TimelineEntry, TodayItem } from '@/services/pulse';

export function todayRecordState(items: TodayItem[], logs: TimelineEntry[], now = new Date()) {
  const { start, end } = localDayRange(now);
  const completedIds = new Set<string>();
  const skippedIds = new Set<string>();
  for (const entry of logs) {
    const time = new Date(entry.logged_at);
    if (!entry.protocol_item_id || time < start || time >= end) continue;
    if (entry.status === 'completed') completedIds.add(entry.protocol_item_id);
    else if (entry.status === 'skipped') skippedIds.add(entry.protocol_item_id);
  }
  // A completed entry takes precedence when a user later records the same item.
  for (const id of completedIds) skippedIds.delete(id);
  const resolvedIds = new Set([...completedIds, ...skippedIds]);
  const completed = items.filter(item => completedIds.has(item.id)).length;
  const skipped = items.filter(item => skippedIds.has(item.id)).length;
  return { completedIds, skippedIds, resolvedIds, completed, skipped, due: items.length,
    percent: items.length ? Math.round((completed / items.length) * 100) : 100 };
}
