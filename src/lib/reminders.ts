import { supabase } from '@/lib/supabase';
import { readOutbox } from '@/lib/outbox';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { buildReminderPlan } from '@/domain/reminderPlan';
import {
  getPrivateNotifications,
  getRemindersEnabled,
  setPrivateNotifications,
  setRemindersEnabled,
} from '@/lib/privacy';
import type { QuickLogPayload } from '@/lib/outbox';
import type { TimelineEntry, TodayItem } from '@/services/pulse';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestReminderPermission() {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('pulse-reminders', {
      name: 'Pulse reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

let notificationUpdates: Promise<unknown> = Promise.resolve();
function updateNotifications<T>(work: () => Promise<T>): Promise<T> {
  const result = notificationUpdates.then(work);
  notificationUpdates = result.catch(() => undefined);
  return result;
}

export function rescheduleReminders(
  items: TodayItem[],
  logs?: TimelineEntry[],
  pending?: QuickLogPayload[],
) {
  return updateNotifications(() =>
    rescheduleRemindersNow(items, logs, pending),
  );
}

async function rescheduleRemindersNow(
  items: TodayItem[],
  logs?: TimelineEntry[],
  pending?: QuickLogPayload[],
) {
  if (Platform.OS === 'web') return 0;
  if (!(await getRemindersEnabled())) return 0;

  // iOS can revoke authorization after reminders were enabled in Pulse.
  // Never attempt to schedule notifications while permission is denied.
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 0;

  if (!logs) {
    const day = new Date();
    day.setDate(day.getDate() - 1);
    const from = day.toISOString().slice(0, 10);
    logs = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase
        .from('dose_logs')
        .select('occurrence_key,status')
        .gte('local_date', from)
        .in('status', ['completed', 'skipped'])
        .order('id')
        .range(offset, offset + 499);
      if (error) throw error;
      logs.push(...(data as TimelineEntry[]));
      if (data.length < 500) break;
    }
  }
  if (!pending) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    pending = session ? await readOutbox(session.user.id) : [];
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  const privateMode = await getPrivateNotifications();
  const now = new Date();
  let count = 0;

  const resolved = new Set([
    ...logs
      .filter((l) => ['completed', 'skipped'].includes(l.status))
      .map((l) => l.occurrence_key),
    ...pending.map((p) => p.occurrenceKey),
  ]);
  for (const { item, when, occurrenceKey } of buildReminderPlan(items, now)) {
    if (resolved.has(occurrenceKey)) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Pulse reminder',
        body: privateMode
          ? 'You have something scheduled in Pulse.'
          : `${item.name} · ${item.dose_amount} ${item.dose_unit}`,
        data: { protocolItemId: item.id, occurrenceKey },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: Platform.OS === 'android' ? 'pulse-reminders' : undefined,
      },
    });
    count += 1;
  }

  return count;
}

export function enableReminders(items: TodayItem[]) {
  return updateNotifications(async () => {
    const allowed = await requestReminderPermission();
    if (!allowed) return false;
    await setRemindersEnabled(true);
    try {
      await rescheduleRemindersNow(items);
      return true;
    } catch (error) {
      await Promise.allSettled([
        setRemindersEnabled(false),
        Notifications.cancelAllScheduledNotificationsAsync(),
      ]);
      throw error;
    }
  });
}

export function disableReminders() {
  return updateNotifications(async () => {
    try {
      await setRemindersEnabled(false);
    } finally {
      if (Platform.OS !== 'web')
        await Notifications.cancelAllScheduledNotificationsAsync();
    }
  });
}

/** Clears pending and delivered alerts; account cleanup manages preferences separately. */
export function clearPendingReminders() {
  return updateNotifications(async () => {
    if (Platform.OS !== 'web') {
      const results = await Promise.allSettled([
        Notifications.cancelAllScheduledNotificationsAsync(),
        Notifications.dismissAllNotificationsAsync(),
      ]);
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('Some device notifications could not be cleared.');
    }
  });
}

/** Cancel detailed pending alerts before any network read or privacy promise. */
export class ReminderPrivacyUpdateError extends Error {
  constructor(
    readonly preferenceSaved: boolean,
    readonly pendingCleared: boolean,
    cause: unknown,
  ) {
    super(
      cause instanceof Error
        ? cause.message
        : 'Notification privacy could not be updated.',
    );
    this.name = 'ReminderPrivacyUpdateError';
  }
}
export function setReminderPrivacy(
  privateMode: boolean,
  refreshItems: () => Promise<TodayItem[]>,
) {
  return updateNotifications(async () => {
    let pendingCleared = false,
      preferenceSaved = false;
    try {
      if (privateMode && Platform.OS !== 'web') {
        await Notifications.cancelAllScheduledNotificationsAsync();
        pendingCleared = true;
      }
      await setPrivateNotifications(privateMode);
      preferenceSaved = true;
      if (Platform.OS === 'web' || !(await getRemindersEnabled())) return 0;
      const items = await refreshItems();
      return await rescheduleRemindersNow(items);
    } catch (error) {
      throw new ReminderPrivacyUpdateError(
        preferenceSaved,
        pendingCleared,
        error,
      );
    }
  });
}

/** One-off local test. Does not change the user's reminder preferences. */
export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const permission = await Notifications.getPermissionsAsync();
  // A test button is an explicit user action, so requesting missing permission is allowed.
  const allowed =
    permission.granted ||
    (permission.canAskAgain && (await requestReminderPermission()));
  if (!allowed) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Pulse test notification',
      body: 'Notifications are working. Live long and prosper. 🖖',
      sound: false,
      data: { kind: 'manual-notification-test' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 8000),
      channelId: Platform.OS === 'android' ? 'pulse-reminders' : undefined,
    },
  });
  return true;
}

export async function cancelOccurrenceReminder(key: string) {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.occurrenceKey === key)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Reads status without requesting permission or scheduling anything. */
export async function getReminderHealth() {
  const enabled = await getRemindersEnabled();
  if (Platform.OS === 'web')
    return {
      enabled,
      permission: { granted: false, canAskAgain: false },
      count: 0,
      web: true,
    };
  const [permission, pending] = await Promise.all([
    Notifications.getPermissionsAsync(),
    Notifications.getAllScheduledNotificationsAsync(),
  ]);
  return {
    enabled,
    permission: {
      granted: permission.granted,
      canAskAgain: permission.canAskAgain,
    },
    count: pending.length,
    web: false,
  };
}
