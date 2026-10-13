export function reminderHealthText(
  enabled: boolean,
  permission: { granted: boolean; canAskAgain: boolean },
  count: number,
  web = false,
) {
  if (web)
    return {
      title: 'Device reminders are unavailable on web',
      body: 'Use Pulse on iOS or Android for local notifications.',
    };
  if (!enabled)
    return {
      title: 'Recurring reminders are off',
      body: 'You can still use the one-off test notification below.',
    };
  if (!permission.granted)
    return {
      title: 'Notifications are blocked or not authorized',
      body: permission.canAskAgain
        ? 'Enable reminders to request notification permission.'
        : 'Open device settings to allow notifications for Pulse.',
    };
  return {
    title: `${count} pending notification${count === 1 ? '' : 's'} on this device`,
    body: 'This count includes protocol reminders and test/supply alerts. Focus, notification settings and device behavior can delay delivery. Use the test alert to check visibility.',
  };
}
