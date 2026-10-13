import {
  deviceTimeZone,
  zonedDateKey,
  type OccurrenceItem,
} from './occurrences';
export function eligibleManualItems<T extends OccurrenceItem>(
  items: T[],
  now = new Date(),
) {
  return items.filter((item) => {
    if (
      item.active === false ||
      item.archived_at ||
      item.schedule.type !== 'as_needed'
    )
      return false;
    const zone =
      typeof item.schedule.timeZone === 'string' &&
      item.schedule.timeZone !== 'local'
        ? item.schedule.timeZone
        : deviceTimeZone();
    const key = zonedDateKey(now, zone);
    const temporary = item.schedule.temporary as
      | { paused?: boolean; startDate?: string; endDate?: string }
      | undefined;
    return (
      (!item.starts_on || key >= item.starts_on) &&
      (!item.ends_on || key <= item.ends_on) &&
      !(
        temporary?.paused &&
        temporary.startDate &&
        temporary.endDate &&
        key >= temporary.startDate &&
        key <= temporary.endDate
      )
    );
  });
}
