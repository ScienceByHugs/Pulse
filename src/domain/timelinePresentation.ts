import { recordDay, validTimeZone } from './occurrences';
import { matchesTimelineSearch } from './timelineSearch';
import type { TimelineEntry, TodayItem } from '@/services/pulse';

export type TimelineFilters = {
  search: string;
  status: string;
  substance: string;
  protocol: string;
  from: string;
  through: string;
};

export function timelineProtocolId(entry: TimelineEntry, items: TodayItem[]) {
  return typeof entry.snapshot?.protocolId === 'string'
    ? entry.snapshot.protocolId
    : items.find((item) => item.id === entry.protocol_item_id)?.protocol_id;
}

export function filterTimelineEntries(
  entries: TimelineEntry[],
  filters: TimelineFilters,
  items: TodayItem[],
) {
  if (filters.from && filters.through && filters.through < filters.from)
    return [];
  return entries.filter((entry) => {
    const day = recordDay(entry);
    return (
      matchesTimelineSearch(entry, filters.search, items) &&
      (!filters.status || entry.status === filters.status) &&
      (!filters.substance || entry.protocol_item_id === filters.substance) &&
      (!filters.protocol ||
        timelineProtocolId(entry, items) === filters.protocol) &&
      (!filters.from || day >= filters.from) &&
      (!filters.through || day <= filters.through)
    );
  });
}

export function groupTimelineByDay(entries: TimelineEntry[]) {
  const groups = new Map<string, TimelineEntry[]>();
  for (const entry of entries) {
    const day = recordDay(entry);
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  // Keys remain complete calendar dates: display labels can repeat across years.
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

export function entriesForCalendarDay(entries: TimelineEntry[], day: string) {
  return entries.filter((entry) => recordDay(entry) === day);
}

export function recordedTimeLabel(entry: TimelineEntry) {
  const zone =
    entry.time_zone && validTimeZone(entry.time_zone)
      ? entry.time_zone
      : undefined;
  return new Date(entry.logged_at).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: zone,
  });
}
