import { isDueOnDate, localDateKey } from './schedule';

const dayFormatters = new Map<string, Intl.DateTimeFormat>();
const wallFormatters = new Map<string, Intl.DateTimeFormat>();
const instantCache = new Map<string, number | null>();
export function validTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
export function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
export function zonedDateKey(date: Date, zone: string) {
  if (!dayFormatters.has(zone))
    dayFormatters.set(
      zone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    );
  const parts = dayFormatters.get(zone)!.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function wallParts(date: Date, zone: string) {
  if (!wallFormatters.has(zone))
    wallFormatters.set(
      zone,
      new Intl.DateTimeFormat('en-GB', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    );
  const parts = wallFormatters.get(zone)!.formatToParts(date);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'));
}
/** Gaps are omitted; repeated fall-back times occur once, at the earlier instant. */
export function wallTimeToInstant(
  key: string,
  time: string,
  zone: string,
): Date | null {
  const cacheKey = `${key}:${time}:${zone}`;
  if (instantCache.has(cacheKey)) {
    const cached = instantCache.get(cacheKey);
    return cached === null ? null : new Date(cached!);
  }
  const [y = 0, m = 1, d = 1] = key.split('-').map(Number);
  const [h = 0, min = 0] = time.split(':').map(Number);
  const target = Date.UTC(y, m - 1, d, h, min);
  let guess = target;
  for (let i = 0; i < 5; i++)
    guess += target - wallParts(new Date(guess), zone);
  const matches: number[] = [];
  for (let delta = -180; delta <= 180; delta += 30) {
    const candidate = guess + delta * 60000;
    if (wallParts(new Date(candidate), zone) === target)
      matches.push(candidate);
  }
  const result = matches.length ? Math.min(...matches) : null;
  if (instantCache.size > 5000) instantCache.clear();
  instantCache.set(cacheKey, result);
  return result === null ? null : new Date(result);
}
export function scheduleTimes(
  schedule: Record<string, unknown>,
  dayKey?: string,
) {
  const temp = schedule.temporary as
    | { startDate?: string; endDate?: string; time?: string; paused?: boolean }
    | undefined;
  if (
    dayKey &&
    temp?.time &&
    !temp.paused &&
    temp.startDate &&
    temp.endDate &&
    dayKey >= temp.startDate &&
    dayKey <= temp.endDate
  )
    return [temp.time];
  const times = Array.isArray(schedule.times)
    ? schedule.times.filter(
        (t): t is string =>
          typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
      )
    : typeof schedule.time === 'string'
      ? [schedule.time]
      : [];
  return [...new Set(times)].sort();
}
export type OccurrenceItem = {
  id: string;
  schedule: Record<string, unknown>;
  starts_on?: string | null;
  ends_on?: string | null;
  active?: boolean;
  archived_at?: string | null;
};
export type OccurrenceFields = {
  occurrenceKey: string;
  scheduledFor: string | null;
  slotTime?: string;
  dayKey: string;
  timeZone: string;
};
export function occurrencesForDay<T extends OccurrenceItem>(
  item: T,
  key: string,
  currentZone = deviceTimeZone(),
): Array<T & OccurrenceFields> {
  if (
    item.active === false ||
    item.archived_at ||
    (item.starts_on && key < item.starts_on) ||
    (item.ends_on && key > item.ends_on)
  )
    return [];
  const [y = 0, m = 1, d = 1] = key.split('-').map(Number);
  if (!isDueOnDate(item.schedule, new Date(y, m - 1, d, 12))) return [];
  const zone =
    typeof item.schedule.timeZone === 'string' &&
    item.schedule.timeZone !== 'local'
      ? item.schedule.timeZone
      : currentZone;
  const times = scheduleTimes(item.schedule, key);
  if (!times.length)
    return [
      {
        ...item,
        occurrenceKey: `${item.id}:${key}:any`,
        scheduledFor: null,
        dayKey: key,
        timeZone: zone,
      },
    ];
  return times.flatMap((time) => {
    const when = wallTimeToInstant(key, time, zone);
    return when
      ? [
          {
            ...item,
            occurrenceKey: `${item.id}:${key}:${time}`,
            scheduledFor: when.toISOString(),
            slotTime: time,
            dayKey: key,
            timeZone: zone,
          },
        ]
      : [];
  });
}
export function todayOccurrences<T extends OccurrenceItem>(
  items: T[],
  now = new Date(),
  currentZone = deviceTimeZone(),
) {
  return items
    .flatMap((item) => {
      const zone =
        typeof item.schedule.timeZone === 'string' &&
        item.schedule.timeZone !== 'local'
          ? item.schedule.timeZone
          : currentZone;
      return occurrencesForDay(item, zonedDateKey(now, zone), currentZone);
    })
    .sort(
      (a, b) =>
        (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? '') ||
        a.id.localeCompare(b.id),
    );
}
export function trackingId(item: { id: string; occurrenceKey?: string }) {
  return item.occurrenceKey ?? item.id;
}
export function entryName(entry: {
  snapshot?: Record<string, unknown> | null;
  protocol_items?: { name: string } | null;
}) {
  return typeof entry.snapshot?.itemName === 'string'
    ? entry.snapshot.itemName
    : (entry.protocol_items?.name ?? 'Tracked substance');
}
export function recordDay(entry: {
  local_date?: string | null;
  logged_at: string;
}) {
  return entry.local_date ?? localDateKey(new Date(entry.logged_at));
}
