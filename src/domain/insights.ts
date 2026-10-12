import { isDueOnDate, localDateKey } from '@/domain/schedule';
import type { TimelineEntry, TodayItem } from '@/services/pulse';

export function calculateSevenDayConsistency(items: TodayItem[], logs: TimelineEntry[], now = new Date()) {
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
      if (item.active === false || item.archived_at) continue;
      if (item.created_at && key < localDateKey(new Date(item.created_at))) continue;
      if (item.starts_on && key < item.starts_on) continue;
      if (item.ends_on && key > item.ends_on) continue;
      if (isDueOnDate(item.schedule, day)) due.add(`${item.id}:${key}`);
    }
  }

  for (const log of logs) {
    if (!log.protocol_item_id) continue;
    const dayKey = localDateKey(new Date(log.logged_at));
    if (!windowKeys.has(dayKey)) continue;
    const key = `${log.protocol_item_id}:${dayKey}`;
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
    percent: due.size ? Math.round((completedDue / due.size) * 100) : 100
  };
}

export function calculateSupplyForecast(items: TodayItem[]) {
  const forecasts = items.flatMap((item) => {
    const containers = (item.inventory_containers ?? []).filter((container) =>
      container.is_active && container.unit === item.dose_unit &&
      Number.isFinite(Number(container.remaining_amount)) &&
      Number.isFinite(Number(container.low_threshold))
    );
    if (!containers.length || item.dose_amount <= 0) return [];

    const remainingInitial = containers.reduce((sum, container) => sum + Number(container.remaining_amount), 0);
    const total = containers.reduce((sum, container) => sum + Number(container.total_amount), 0);
    const threshold = containers.reduce((sum, container) => sum + Number(container.low_threshold), 0);
    const dosesRemaining = Math.floor(remainingInitial / item.dose_amount);
    let projectedLowInDays: number | null = remainingInitial <= threshold ? 0 : null;
    let remaining = remainingInitial;
    const today = new Date();

    if (projectedLowInDays === null) {
      for (let offset = 0; offset <= 365; offset += 1) {
        const day = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
        day.setDate(day.getDate() + offset);
        if (!isDueOnDate(item.schedule, day)) continue;
        remaining -= item.dose_amount;
        if (remaining <= threshold) {
          projectedLowInDays = offset;
          break;
        }
      }
    }

    return [{
      itemId: item.id,
      name: item.name,
      unit: item.dose_unit,
      remaining: remainingInitial,
      total,
      dosesRemaining,
      projectedLowInDays
    }];
  });

  forecasts.sort((a, b) => (a.projectedLowInDays ?? Number.MAX_SAFE_INTEGER) - (b.projectedLowInDays ?? Number.MAX_SAFE_INTEGER));
  return forecasts;
}

export function siteRotationSummary(logs: TimelineEntry[]) {
  const recent = logs.filter((log) => log.site && log.status === 'completed').slice(0, 30);
  return {
    uniqueSites: new Set(recent.map((log) => log.site)).size,
    administrations: recent.length
  };
}
