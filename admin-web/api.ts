import { createClient } from '@supabase/supabase-js';
import type { FeedbackStatus } from '../src/domain/feedback';
export const adminClient = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      storage: window.sessionStorage,
      storageKey: 'pulse-admin.session',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
export type AdminAccess = { member: boolean; authorized: boolean };
export { type AdminOverview, type AdminTicket } from './data';
import {
  parseOverview,
  parseTicket,
  type AdminOverview,
  type AdminTicket,
} from './data';
export class AdminRequestError extends Error {
  constructor(
    readonly needsVerification: boolean,
    message: string,
  ) {
    super(message);
  }
}
async function call(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await adminClient.rpc(name, args);
  if (error) {
    const verify =
      error.code === '42501' ||
      error.message.includes('ADMIN_VERIFICATION_REQUIRED');
    throw new AdminRequestError(
      verify,
      verify
        ? 'Verify your admin sign-in again to continue.'
        : error.message.includes('FEEDBACK_STATUS_CHANGED')
          ? 'This ticket changed in another window. Refresh before saving.'
          : 'The request could not finish. Check your connection and retry.',
    );
  }
  return data;
}
export async function getAdminAccess(): Promise<AdminAccess> {
  const data = await call('pulse_admin_access');
  if (
    !data ||
    typeof data.member !== 'boolean' ||
    typeof data.authorized !== 'boolean' ||
    (data.authorized && !data.member)
  )
    throw new Error('Admin access could not be verified.');
  return { member: data.member, authorized: data.authorized };
}
export async function getAdminOverview(): Promise<AdminOverview> {
  return parseOverview(await call('pulse_admin_overview'));
}
export async function getAdminFeedback(
  status: FeedbackStatus | '',
  cursor?: { id: string; created_at: string },
) {
  const data = await call('pulse_admin_feedback', {
    p_status: status || null,
    p_before_date: cursor?.created_at ?? null,
    p_before_id: cursor?.id ?? null,
  });
  if (!Array.isArray(data)) throw new Error('Feedback could not load.');
  const rows = data.map(parseTicket);
  return { rows: rows.slice(0, 50), next: rows.length > 50 ? rows[49]! : null };
}
export async function setTicketStatus(
  ticket: AdminTicket,
  status: FeedbackStatus,
) {
  const result = await call('pulse_admin_set_feedback_status', {
    p_id: ticket.id,
    p_status: status,
    p_expected_status: ticket.status,
  });
  if (result?.id !== ticket.id || result?.status !== status)
    throw new Error('The update could not be confirmed. Refresh this ticket.');
}
