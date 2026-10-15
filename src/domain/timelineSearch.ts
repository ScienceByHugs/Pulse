import { entryName } from './occurrences';
import type { TimelineEntry, TodayItem } from '@/services/pulse';
export function matchesTimelineSearch(
  entry: TimelineEntry,
  search: string,
  items: TodayItem[],
) {
  const normal = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const fields = normal(
    `${entryName(entry)} ${entry.snapshot?.protocolName ?? ''} ${items.find((i) => i.id === entry.protocol_item_id)?.name ?? ''}`,
  );
  return normal(search)
    .trim()
    .split(/\s+/)
    .every((word) => fields.includes(word));
}
