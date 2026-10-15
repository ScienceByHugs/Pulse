export const feedbackCategories = [
  { value: 'problem', label: 'Problem' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'update', label: 'Recent change' },
] as const;
export const feedbackStatuses = [
  { value: 'received', label: 'Received' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'planned', label: 'Planned' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'closed', label: 'Closed' },
] as const;
export type FeedbackCategory = (typeof feedbackCategories)[number]['value'];
export type FeedbackStatus = (typeof feedbackStatuses)[number]['value'];
export type FeedbackRequest = {
  id: string;
  category: FeedbackCategory;
  message: string;
  allowContact: boolean;
  appVersion: string;
  buildNumber: string;
  platform: 'ios' | 'android' | 'web';
};
export type FeedbackEntry = {
  id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  app_version: string;
  build_number: string;
  platform: FeedbackRequest['platform'];
  created_at: string;
  updated_at: string;
};
export function validFeedbackRequest(value: unknown): value is FeedbackRequest {
  if (!value || typeof value !== 'object') return false;
  const row = value as FeedbackRequest;
  return (
    typeof row.id === 'string' &&
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id) &&
    feedbackCategories.some((c) => c.value === row.category) &&
    typeof row.message === 'string' &&
    row.message.trim().length >= 10 &&
    row.message.trim().length <= 2000 &&
    typeof row.allowContact === 'boolean' &&
    typeof row.appVersion === 'string' &&
    row.appVersion.length > 0 &&
    row.appVersion.length <= 32 &&
    typeof row.buildNumber === 'string' &&
    row.buildNumber.length > 0 &&
    row.buildNumber.length <= 32 &&
    ['ios', 'android', 'web'].includes(row.platform)
  );
}
export function feedbackStatusLabel(status: FeedbackStatus) {
  return feedbackStatuses.find((s) => s.value === status)?.label ?? 'Received';
}
export function feedbackFailure(error: unknown) {
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : '';
  if (message.includes('FEEDBACK_RATE_LIMIT'))
    return 'You’ve reached the feedback limit for now. Try again later; your message is saved on this device.';
  if (
    message.includes('FEEDBACK_ACCOUNT_CHANGED') ||
    message.includes('FEEDBACK_SIGN_IN_REQUIRED')
  )
    return 'Your account changed or needs to sign in again. Reopen feedback after signing in.';
  if (message.includes('FEEDBACK_INVALID'))
    return 'Choose a category and enter 10–2,000 characters.';
  if (
    message.includes('FEEDBACK_RETRY_MISMATCH') ||
    message.includes('FEEDBACK_CONFLICT')
  )
    return 'Check My feedback before starting another message. The original submission needs confirmation.';
  return 'Could not confirm this submission. Your message is saved on this device. Retry to check the same ticket.';
}
