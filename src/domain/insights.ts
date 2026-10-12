import { occurrencesForDay, recordDay } from './occurrences';
import { supplyEstimate } from './inventory';
import type { ItemVersion } from '@/services/pulse';
import { isDueOnDate, localDateKey } from '@/domain/schedule';
import type { TimelineEntry, TodayItem } from '@/services/pulse';

export function calculateSevenDayConsistency(
  items: TodayItem[],
  logs: TimelineEntry[],
  now = new Date(),
  versions?: ItemVersion[],
) {
  // Compare exact local calendar dates, not elapsed milliseconds (DST-safe).
  const due = new Set<string>();
  const completed = new Set<string>();
  const skipped = new Set<string>();
  const windowKeys = new Set<string>();

  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    day.setDate(day.getDate() - offset);
    const key = localDateKey(day);
    windowKeys.add(key);
    for (const item of items) {
      if (versions) {
        const rows = versions
          .filter((v) => v.protocol_item_id === item.id)
          .sort(
            (a, b) =>
              a.effective_at.localeCompare(b.effective_at) ||
              (a.version_order ?? 0) - (b.version_order ?? 0),
          );
        rows.forEach((version, index) => {
          const snap = version.snapshot;
          if (snap.protocolStatus !== 'active') return;
          const historical = {
            ...item,
            schedule: (snap.schedule ?? {}) as Record<string, unknown>,
            active: snap.active !== false,
            archived_at: snap.archivedAt as string | null,
            starts_on: snap.startsOn as string | null,
            ends_on: snap.endsOn as string | null,
          };
          for (const occurrence of occurrencesForDay(historical, key)) {
            const when = occurrence.scheduledFor
              ? new Date(occurrence.scheduledFor)
              : new Date(`${key}T23:59:59`);
            const next = rows[index + 1];
            if (
              when >= new Date(version.effective_at) &&
              (!next || when < new Date(next.effective_at))
            )
              due.add(occurrence.occurrenceKey);
          }
        });
      } else {
        if (item.active === false || item.archived_at) continue;
        if (item.created_at && key < localDateKey(new Date(item.created_at)))
          continue;
        for (const occurrence of occurrencesForDay(item, key))
          due.add(occurrence.occurrenceKey);
      }
    }
  }

  for (const log of logs) {
    if (!log.protocol_item_id) continue;
    const dayKey = recordDay(log);
    if (!windowKeys.has(dayKey)) continue;
    const key =
      log.occurrence_key ??
      [...due].find((key) =>
        key.startsWith(`${log.protocol_item_id}:${dayKey}:`),
      ) ??
      `${log.protocol_item_id}:${dayKey}:any`;
    if (log.status === 'completed') completed.add(key);
    if (log.status === 'skipped') skipped.add(key);
  }

  let completedDue = 0;
  let skippedDue = 0;
  for (const key of due) {
    if (completed.has(key)) completedDue += 1;
    else if (skipped.has(key)) skippedDue += 1;
  }

  return {
    due: due.size,
    completed: completedDue,
    skipped: skippedDue,
    missed: Math.max(0, due.size - completedDue - skippedDue),
    percent: due.size ? Math.round((completedDue / due.size) * 100) : 100,
  };
}

export function calculateSupplyForecast(
  items: TodayItem[],
  logs: TimelineEntry[] = [],
) {
  return items
    .flatMap((item) => {
      const estimate = supplyEstimate(
        item,
        new Date(),
        new Set(
          logs
            .filter((l) => ['completed', 'skipped'].includes(l.status))
            .map((l) => l.occurrence_key)
            .filter((key): key is string => Boolean(key)),
        ),
      );
      if (!estimate.containers.length) return [];
      const days = estimate.lowAt
        ? Math.max(
            0,
            Math.round(
              (new Date(estimate.lowAt + 'T12:00:00').getTime() -
                new Date().getTime()) /
                86400000,
            ),
          )
        : null;
      return [
        {
          itemId: item.id,
          name: item.name,
          unit: item.dose_unit,
          remaining: estimate.remaining,
          total: estimate.containers.reduce(
            (sum, c) => sum + Number(c.total_amount),
            0,
          ),
          dosesRemaining: estimate.entries,
          projectedLowInDays: estimate.low ? 0 : days,
        },
      ];
    })
    .sort(
      (a, b) =>
        (a.projectedLowInDays ?? Infinity) - (b.projectedLowInDays ?? Infinity),
    );
}

export function siteRotationSummary(logs: TimelineEntry[]) {
  const recent = logs
    .filter((log) => log.site && log.status === 'completed')
    .slice(0, 30);
  return {
    uniqueSites: new Set(recent.map((log) => log.site)).size,
    administrations: recent.length,
  };
}
