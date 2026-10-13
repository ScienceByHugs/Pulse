import { validateTrackedSchedule, type Schedule } from './schedule';

type ScheduleDraft = {
  type: Schedule['type'];
  time: string;
  additionalTimes: string[];
  timeZone: string;
  days: number[];
  everyDays: string;
  onDays: string;
  offDays: string;
  startDate: string;
};

/** Validate entered schedules without substituting a routine for missing input. */
export function protocolDraftSchedule(draft: ScheduleDraft) {
  if (draft.type === 'as_needed') return { type: 'as_needed' };
  const parsedDays = (value: string) =>
    /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  const time = draft.time.trim();
  const schedule: Record<string, unknown> = {
    type: draft.type,
    ...(time ? { time } : {}),
    times: [time, ...draft.additionalTimes.map((t) => t.trim())].filter(Boolean),
    timeZone: draft.timeZone,
  };
  if (draft.type === 'weekdays') schedule.days = draft.days;
  if (draft.type === 'interval') {
    schedule.everyDays = parsedDays(draft.everyDays);
    schedule.startDate = draft.startDate;
  }
  if (draft.type === 'cycle') {
    schedule.onDays = parsedDays(draft.onDays);
    schedule.offDays = parsedDays(draft.offDays);
    schedule.startDate = draft.startDate;
  }
  return validateTrackedSchedule(schedule);
}
