export type Schedule =
  | { type: 'daily'; time?: string }
  | { type: 'weekdays'; time?: string; days: number[] }
  | { type: 'interval'; time?: string; everyDays: number; startDate: string }
  | {
      type: 'cycle';
      time?: string;
      onDays: number;
      offDays: number;
      startDate: string;
    }
  | { type: 'as_needed' };

export type TemporarySchedule = {
  startDate: string;
  endDate: string;
  paused?: boolean;
  time?: string;
};

function dateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDate(value: string) {
  const [rawY, rawM, rawD] = value.split('-').map(Number);
  const y = Number.isFinite(rawY) ? rawY : 1970;
  const m = Number.isFinite(rawM) ? rawM : 1;
  const d = Number.isFinite(rawD) ? rawD : 1;
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(a: Date, b: Date) {
  const aDay = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bDay = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((aDay - bDay) / 86400000);
}

export function scheduleTime(
  schedule: Record<string, unknown>,
  date = new Date(),
) {
  const temp = schedule.temporary as TemporarySchedule | undefined;
  const key = localDateKey(date);
  if (
    temp?.time &&
    temp.startDate &&
    temp.endDate &&
    key >= temp.startDate &&
    key <= temp.endDate &&
    !temp.paused
  ) {
    return temp.time;
  }
  return typeof schedule.time === 'string' ? schedule.time : undefined;
}

export function isDueOnDate(
  schedule: Record<string, unknown>,
  date = new Date(),
) {
  if (!schedule || Object.keys(schedule).length === 0) return true;

  const temp = schedule.temporary as TemporarySchedule | undefined;
  if (temp?.startDate && temp?.endDate) {
    const start = parseLocalDate(temp.startDate);
    const end = parseLocalDate(temp.endDate);
    const day = dateOnly(date);
    if (day >= dateOnly(start) && day <= dateOnly(end) && temp.paused)
      return false;
  }

  const type = typeof schedule.type === 'string' ? schedule.type : 'daily';

  if (type === 'as_needed') return false;
  if (type === 'daily') return true;

  if (type === 'weekdays') {
    const days = Array.isArray(schedule.days)
      ? schedule.days.filter((v): v is number => typeof v === 'number')
      : [];
    return days.includes(date.getDay());
  }

  if (type === 'interval') {
    const everyDays =
      typeof schedule.everyDays === 'number'
        ? Math.max(1, Math.floor(schedule.everyDays))
        : 1;
    const startDate =
      typeof schedule.startDate === 'string'
        ? parseLocalDate(schedule.startDate)
        : date;
    const diff = daysBetween(date, startDate);
    return diff >= 0 && diff % everyDays === 0;
  }

  if (type === 'cycle') {
    const onDays =
      typeof schedule.onDays === 'number'
        ? Math.max(1, Math.floor(schedule.onDays))
        : 1;
    const offDays =
      typeof schedule.offDays === 'number'
        ? Math.max(0, Math.floor(schedule.offDays))
        : 0;
    const startDate =
      typeof schedule.startDate === 'string'
        ? parseLocalDate(schedule.startDate)
        : date;
    const diff = daysBetween(date, startDate);
    if (diff < 0) return false;
    const length = onDays + offDays;
    return length > 0 && diff % length < onDays;
  }

  return true;
}

export function formatSchedule(schedule: Record<string, unknown>) {
  const type = typeof schedule.type === 'string' ? schedule.type : 'daily';
  const time =
    Array.isArray(schedule.times) && schedule.times.length
      ? schedule.times.join(', ')
      : scheduleTime(schedule);

  if (type === 'daily') return time ? `Daily · ${time}` : 'Daily';
  if (type === 'weekdays') {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = Array.isArray(schedule.days)
      ? (schedule.days as number[])
      : [];
    return `${
      days
        .map((d) => labels[d])
        .filter(Boolean)
        .join(', ') || 'Selected days'
    }${time ? ` · ${time}` : ''}`;
  }
  if (type === 'interval')
    return `Every ${schedule.everyDays ?? 1} days${time ? ` · ${time}` : ''}`;
  if (type === 'cycle')
    return `${schedule.onDays ?? 1} on / ${schedule.offDays ?? 0} off${time ? ` · ${time}` : ''}`;
  return 'As needed';
}

// Validate user-authored schedules before saving them to a tracked substance.
// Existing optional temporary overrides are kept separate from the edited base schedule.
export function validateTrackedSchedule(schedule: Record<string, unknown>) {
  const type = schedule.type;
  if (
    !['daily', 'weekdays', 'interval', 'cycle', 'as_needed'].includes(
      String(type),
    )
  ) {
    throw new Error('Choose a supported schedule.');
  }
  const times = schedule.times;
  if (
    times !== undefined &&
    (!Array.isArray(times) ||
      times.length > 8 ||
      new Set(times).size !== times.length ||
      times.some(
        (t) => typeof t !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t),
      ))
  )
    throw new Error('Choose up to eight different times.');
  if (schedule.timeZone !== undefined && schedule.timeZone !== 'local') {
    try {
      new Intl.DateTimeFormat('en', {
        timeZone: String(schedule.timeZone),
      }).format();
    } catch {
      throw new Error('Choose a valid time zone, such as America/Los_Angeles.');
    }
  }
  const time = schedule.time;
  if (type !== 'as_needed' && time !== undefined) {
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error('Use a valid time in 24-hour HH:MM format.');
    }
  }
  if (type === 'weekdays') {
    const days = schedule.days;
    if (
      !Array.isArray(days) ||
      days.length === 0 ||
      days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    ) {
      throw new Error('Choose at least one valid weekday.');
    }
  }
  if (type === 'interval' || type === 'cycle') {
    const startDate = schedule.startDate;
    if (
      typeof startDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ) {
      throw new Error('Enter the schedule anchor date in YYYY-MM-DD format.');
    }
    const [year = 0, month = 0, day = 0] = startDate.split('-').map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      throw new Error('Enter a real schedule anchor date.');
    }
  }
  if (
    type === 'interval' &&
    (!Number.isInteger(schedule.everyDays) ||
      Number(schedule.everyDays) < 1 ||
      Number(schedule.everyDays) > 365)
  ) {
    throw new Error('Interval must be a whole number from 1 to 365 days.');
  }
  if (type === 'cycle') {
    if (
      !Number.isInteger(schedule.onDays) ||
      Number(schedule.onDays) < 1 ||
      Number(schedule.onDays) > 365
    ) {
      throw new Error('Cycle on-days must be a whole number from 1 to 365.');
    }
    if (
      !Number.isInteger(schedule.offDays) ||
      Number(schedule.offDays) < 0 ||
      Number(schedule.offDays) > 365
    ) {
      throw new Error('Cycle off-days must be a whole number from 0 to 365.');
    }
  }
  return schedule;
}

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function localDayRange(date = new Date()) {
  const start = dateOnly(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function nextScheduledTimeToday(
  schedules: Record<string, unknown>[],
  now = new Date(),
) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return schedules
    .map((schedule) => scheduleTime(schedule, now))
    .filter((time): time is string => Boolean(time))
    .map((time) => {
      const match = /^(\d{1,2}):(\d{2})$/.exec(time);
      if (!match) return null;
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (hour > 23 || minute > 59) return null;
      return { time, minutes: hour * 60 + minute };
    })
    .filter(
      (entry): entry is { time: string; minutes: number } => entry !== null,
    )
    .filter((entry) => entry.minutes >= currentMinutes)
    .sort((a, b) => a.minutes - b.minutes)[0]?.time;
}
