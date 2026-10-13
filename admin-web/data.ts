import {
  feedbackCategories,
  feedbackStatuses,
  type FeedbackEntry,
} from '../src/domain/feedback';
export type AdminOverview = {
  registered_users: number;
  verified_users: number;
  pending_confirmation: number;
  new_verified_7_days: number;
  new_verified_30_days: number;
  open_feedback: number;
  received_feedback: number;
  signup_days: Array<{ day: string; count: number }>;
  generated_at: string;
};
export type AdminTicket = FeedbackEntry & { contact_email: string | null };
const fail = () => {
  throw new Error(
    'The dashboard response could not be verified. Refresh and try again.',
  );
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail();
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    return fail();
  return value;
}
function text(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > max)
    return fail();
  return value;
}
function timestamp(value: unknown): string {
  const result = text(value, 64);
  if (!Number.isFinite(new Date(result).getTime())) return fail();
  return result;
}
export function parseOverview(value: unknown): AdminOverview {
  const row = object(value);
  if (!Array.isArray(row.signup_days) || row.signup_days.length !== 30)
    return fail();
  const days = row.signup_days.map((value) => {
    const day = object(value);
    const key = text(day.day, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return fail();
    return { day: key, count: count(day.count) };
  });
  return {
    registered_users: count(row.registered_users),
    verified_users: count(row.verified_users),
    pending_confirmation: count(row.pending_confirmation),
    new_verified_7_days: count(row.new_verified_7_days),
    new_verified_30_days: count(row.new_verified_30_days),
    open_feedback: count(row.open_feedback),
    received_feedback: count(row.received_feedback),
    signup_days: days,
    generated_at: timestamp(row.generated_at),
  };
}
export function parseTicket(value: unknown): AdminTicket {
  const row = object(value);
  const id = text(row.id, 36);
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return fail();
  if (
    !feedbackCategories.some((c) => c.value === row.category) ||
    !feedbackStatuses.some((s) => s.value === row.status) ||
    !['ios', 'android', 'web'].includes(String(row.platform))
  )
    return fail();
  const contact =
    row.contact_email === null ? null : text(row.contact_email, 320);
  return {
    id,
    category: row.category as AdminTicket['category'],
    message: text(row.message),
    status: row.status as AdminTicket['status'],
    app_version: text(row.app_version, 32),
    build_number: text(row.build_number, 32),
    platform: row.platform as AdminTicket['platform'],
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    contact_email: contact,
  };
}
