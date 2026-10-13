import {
  trackingId,
  zonedDateKey,
  deviceTimeZone,
  type OccurrenceFields,
  type OccurrenceItem,
} from './occurrences';

export function groupToday<T extends { id: string } & OccurrenceFields>(
  items: T[],
  completed: Set<string>,
  skipped: Set<string>,
  pending: Set<string>,
  now = new Date(),
) {
  const remaining: T[] = [],
    waiting: T[] = [],
    logged: T[] = [],
    skippedItems: T[] = [];
  for (const item of items) {
    const key = trackingId(item);
    if (pending.has(key)) waiting.push(item);
    else if (completed.has(key)) logged.push(item);
    else if (skipped.has(key)) skippedItems.push(item);
    else remaining.push(item);
  }
  remaining.sort(
    (a, b) =>
      (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? '') ||
      a.id.localeCompare(b.id),
  );
  const next = remaining.find(
    (i) => i.scheduledFor && new Date(i.scheduledFor) >= now,
  );
  return {
    remaining,
    waiting,
    logged,
    skipped: skippedItems,
    next,
    earlier: remaining.filter(
      (i) => i.scheduledFor && new Date(i.scheduledFor) < now,
    ).length,
  };
}
export function todayEmptyMessage(
  items: OccurrenceItem[],
  tracked: number,
  paused: number,
  now = new Date(),
) {
  if (!tracked)
    return {
      title: 'Your routine starts here',
      body: 'Create a protocol, then add the substances you already track.',
      action: 'Create a protocol',
    };
  if (paused >= tracked)
    return {
      title: 'Your routine is paused',
      body: 'Your substances or their protocols are paused. Resume them in Protocol when you choose.',
      action: 'Manage paused routines',
    };
  const inside = items.filter((i) => {
    const zone =
      typeof i.schedule.timeZone === 'string' && i.schedule.timeZone !== 'local'
        ? i.schedule.timeZone
        : deviceTimeZone();
    const key = zonedDateKey(now, zone);
    return (
      (!i.starts_on || key >= i.starts_on) && (!i.ends_on || key <= i.ends_on)
    );
  });
  if (items.length && !inside.length)
    return {
      title: 'Outside your tracking dates',
      body: 'Your active protocol dates do not include today. Review the start and end dates in Protocol.',
      action: 'Review protocol dates',
    };
  if (inside.length && inside.every((i) => i.schedule.type === 'as_needed'))
    return {
      title: 'No scheduled entries today',
      body: 'Your active substances are tracked as needed. Review their routines in Protocol.',
      action: 'Review routines',
    };
  return {
    title: 'Nothing scheduled today',
    body: 'Your saved weekdays, intervals, cycles or temporary pauses leave today clear. Review your schedule if that is unexpected.',
    action: 'Review schedules',
  };
}
