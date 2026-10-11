import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { buildReminderPlan } from '@/domain/reminderPlan';
import { getPrivateNotifications, getRemindersEnabled, setRemindersEnabled } from '@/lib/privacy';
import type { TodayItem } from '@/services/pulse';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

export async function requestReminderPermission() {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('pulse-reminders', {
      name: 'Pulse reminders',
      importance: Notifications.AndroidImportance.DEFAULT
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function rescheduleReminders(items: TodayItem[]) {
  if (Platform.OS === 'web') return 0;
  if (!(await getRemindersEnabled())) return 0;

  // iOS can revoke authorization after reminders were enabled in Pulse.
  // Never attempt to schedule notifications while permission is denied.
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 0;

  await Notifications.cancelAllScheduledNotificationsAsync();
  const privateMode = await getPrivateNotifications();
  const now = new Date();
  let count = 0;

  for (const { item, when } of buildReminderPlan(items, now)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Pulse reminder',
        body: privateMode ? 'You have something scheduled in Pulse.' : `${item.name} · ${item.dose_amount} ${item.dose_unit}`,
        data: { protocolItemId: item.id }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: Platform.OS === 'android' ? 'pulse-reminders' : undefined
      }
    });
    count += 1;
  }

  return count;
}

export async function enableReminders(items: TodayItem[]) {
  const allowed = await requestReminderPermission();
  if (!allowed) return false;
  await setRemindersEnabled(true);
  await rescheduleReminders(items);
  return true;
}

export async function disableReminders() {
  await setRemindersEnabled(false);
  if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync();
}

/** One-off local test. Does not change the user's reminder preferences. */
export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const permission = await Notifications.getPermissionsAsync();
  // A test button is an explicit user action, so requesting missing permission is allowed.
  const allowed = permission.granted || (permission.canAskAgain && await requestReminderPermission());
  if (!allowed) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Pulse test notification',
      body: 'Notifications are working. Live long and prosper. 🖖',
      sound: false,
      data: { kind: 'manual-notification-test' }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 8000),
      channelId: Platform.OS === 'android' ? 'pulse-reminders' : undefined
    }
  });
  return true;
}
