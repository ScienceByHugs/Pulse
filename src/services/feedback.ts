import { supabase } from '@/lib/supabase';
import { clearFeedbackDraft, saveFeedbackDraft } from '@/lib/feedbackDrafts';
import {
  feedbackFailure,
  validFeedbackRequest,
  type FeedbackEntry,
  type FeedbackRequest,
} from '@/domain/feedback';
export type FeedbackCursor = { id: string; created_at: string };
export class FeedbackSendError extends Error {
  constructor(
    message: string,
    readonly draftSaved: boolean,
  ) {
    super(message);
  }
}
export async function listMyFeedback(owner: string, cursor?: FeedbackCursor) {
  let query = supabase
    .from('feedback_submissions')
    .select(
      'id,user_id,category,message,status,app_version,build_number,platform,created_at,updated_at',
    )
    .eq('user_id', owner)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(51);
  if (cursor) {
    if (
      !/^[0-9a-f-]{36}$/i.test(cursor.id) ||
      !/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(cursor.created_at)
    )
      throw new Error(
        'Could not continue feedback history. Refresh and try again.',
      );
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  }
  const { data, error } = await query;
  if (error)
    throw new Error(
      'Feedback could not load. Check your connection and retry.',
    );
  if (!Array.isArray(data) || data.some((row) => row.user_id !== owner))
    throw new Error('Could not verify the owner of this feedback.');
  const entries = data
    .slice(0, 50)
    .map(({ user_id, ...entry }) => entry as FeedbackEntry);
  return {
    entries,
    next: data.length > 50 ? (entries.at(-1)! as FeedbackCursor) : null,
  };
}
export async function sendFeedback(owner: string, request: FeedbackRequest) {
  if (!validFeedbackRequest(request))
    throw new FeedbackSendError(
      'Choose a category and enter 10–2,000 characters.',
      false,
    );
  // Cached identity is used only to bind private local storage. Every backend
  // write still checks the current Auth user and expected owner inside the RPC.
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (
    sessionError ||
    !session?.user.email_confirmed_at ||
    session.user.id !== owner
  )
    throw new FeedbackSendError(
      'Your account changed or needs to sign in again. Reopen feedback after signing in.',
      false,
    );
  try {
    await saveFeedbackDraft(owner, request);
  } catch (e) {
    throw new FeedbackSendError(
      e instanceof Error && /earlier|original|could not be read/.test(e.message)
        ? e.message
        : 'Could not save your draft on this device. Nothing was sent. Keep this form open and retry.',
      false,
    );
  }
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw new FeedbackSendError(feedbackFailure(null), true);
    if (!user?.email_confirmed_at || user.id !== owner)
      throw new FeedbackSendError(
        'Your account changed or needs to sign in again. Your draft is retained for the original account.',
        true,
      );
    const { data, error: writeError } = await supabase.rpc(
      'pulse_submit_feedback',
      {
        p_id: request.id,
        p_owner_id: owner,
        p_category: request.category,
        p_message: request.message.trim(),
        p_app_version: request.appVersion,
        p_build_number: request.buildNumber,
        p_platform: request.platform,
        p_allow_contact: request.allowContact,
      },
    );
    if (writeError)
      throw new FeedbackSendError(feedbackFailure(writeError), true);
    if (!data || data.id !== request.id || typeof data.status !== 'string')
      throw new FeedbackSendError(feedbackFailure(null), true);
    let draftCleared = true;
    try {
      draftCleared = await clearFeedbackDraft(owner, request.id);
    } catch {
      draftCleared = false;
    }
    return { id: data.id as string, draftCleared };
  } catch (e) {
    if (e instanceof FeedbackSendError) throw e;
    throw new FeedbackSendError(feedbackFailure(null), true);
  }
}
