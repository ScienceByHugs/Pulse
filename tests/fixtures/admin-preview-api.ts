// Local layout fixture only. Never included by scripts/build-admin-web.cjs.
// No Supabase client, credentials, records or requests exist in this adapter.
import type { AdminOverview, AdminTicket } from '../../admin-web/data';
export type { AdminOverview, AdminTicket } from '../../admin-web/data';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { FeedbackStatus } from '../../src/domain/feedback';
export class AdminRequestError extends Error {
  needsVerification = false;
}
const session = {
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    email_confirmed_at: '2026-10-13T00:00:00Z',
  },
  access_token: 'LOCAL-FICTIONAL-PREVIEW',
} as Session;
let signedIn = true;
let callback: ((event: string, value: Session | null) => void) | null = null;
export const adminClient = {
  auth: {
    getSession: async () => ({
      data: { session: signedIn ? session : null },
      error: null,
    }),
    getUser: async () => ({
      data: { user: signedIn ? session.user : null },
      error: null,
    }),
    onAuthStateChange: (cb: typeof callback) => {
      callback = cb;
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              callback = null;
            },
          },
        },
      };
    },
    signOut: async () => {
      signedIn = false;
      callback?.('SIGNED_OUT', null);
      return { error: null };
    },
  },
} as unknown as SupabaseClient;
export const getAdminAccess = async () => ({
  member: signedIn,
  authorized: signedIn,
});
const days = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 8, 14 + i)).toISOString().slice(0, 10),
  count: i % 4 === 0 ? 3 : i % 3 === 0 ? 1 : 0,
}));
const thirty = days.reduce((n, d) => n + d.count, 0);
export const getAdminOverview = async (): Promise<AdminOverview> => ({
  registered_users: 128,
  verified_users: 119,
  pending_confirmation: 9,
  new_verified_7_days: days.slice(-7).reduce((n, d) => n + d.count, 0),
  new_verified_30_days: thirty,
  open_feedback: 2,
  received_feedback: 1,
  signup_days: days,
  generated_at: '2026-10-13T14:00:00Z',
});
const tickets: AdminTicket[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    category: 'suggestion',
    message:
      'The new pop-ups are much easier to use. Could the Timeline filter remember my last choice?',
    status: 'received',
    app_version: '2.0.0',
    build_number: '14',
    platform: 'ios',
    created_at: '2026-10-13T10:00:00Z',
    updated_at: '2026-10-13T10:00:00Z',
    contact_email: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    category: 'problem',
    message:
      'A long button label wraps on a smaller screen. More space around the controls would help.',
    status: 'reviewing',
    app_version: '2.0.0',
    build_number: '14',
    platform: 'android',
    created_at: '2026-10-12T10:00:00Z',
    updated_at: '2026-10-12T10:00:00Z',
    contact_email: 'fictional@example.invalid',
  },
];
export const getAdminFeedback = async (status: FeedbackStatus | '') => ({
  rows: tickets.filter((t) => !status || t.status === status),
  next: null,
});
export const setTicketStatus = async (
  ticket: AdminTicket,
  status: FeedbackStatus,
) => {
  const found = tickets.find((t) => t.id === ticket.id);
  if (found) found.status = status;
};
