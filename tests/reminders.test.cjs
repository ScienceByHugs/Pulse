const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');
function harness() {
  let scheduled = [],
    allowed = true,
    canceled = 0;
  const notifications = {
    setNotificationHandler() {},
    getPermissionsAsync: async () => ({
      granted: allowed,
      status: allowed ? 'granted' : 'denied',
    }),
    cancelAllScheduledNotificationsAsync: async () => {
      scheduled = [];
      canceled++;
    },
    scheduleNotificationAsync: async (value) => {
      scheduled.push({ ...value, identifier: String(scheduled.length) });
      return String(scheduled.length - 1);
    },
    getAllScheduledNotificationsAsync: async () => scheduled,
    cancelScheduledNotificationAsync: async (id) => {
      scheduled = scheduled.filter((n) => n.identifier !== id);
    },
    SchedulableTriggerInputTypes: { DATE: 'date' },
  };
  const service = loader({
    'react-native': { Platform: { OS: 'ios' } },
    'expo-notifications': notifications,
    '@/lib/supabase': { supabase: {} },
    '@/lib/outbox': { readOutbox: async () => [] },
    '@/lib/privacy': {
      getPrivateNotifications: async () => true,
      getRemindersEnabled: async () => true,
      setRemindersEnabled: async () => {},
    },
  })('src/lib/reminders.ts');
  return {
    service,
    getScheduled: () => scheduled,
    setAllowed: (v) => (allowed = v),
    getCanceled: () => canceled,
  };
}
test('completed and pending occurrences are omitted from reminders, with private text and deep-link IDs', async () => {
  const h = harness();
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  const day = next.toISOString().slice(0, 10);
  const item = {
    id: 'item',
    name: 'Private substance',
    dose_amount: 2,
    dose_unit: 'mg',
    schedule: { type: 'daily', times: ['08:00', '18:00'], timeZone: 'UTC' },
  };
  await h.service.rescheduleReminders(
    [item],
    [{ status: 'completed', occurrence_key: `item:${day}:08:00` }],
    [{ occurrenceKey: `item:${day}:18:00` }],
  );
  assert.equal(
    h
      .getScheduled()
      .some((n) => n.content.data.occurrenceKey.startsWith(`item:${day}:`)),
    false,
  );
  assert.ok(h.getScheduled().length > 0);
  assert.equal(
    h.getScheduled().some((n) => n.content.body.includes('Private substance')),
    false,
  );
  const target = h.getScheduled()[0].content.data.occurrenceKey;
  assert.equal(h.getScheduled()[0].content.data.protocolItemId, 'item');
  await h.service.cancelOccurrenceReminder(target);
  assert.equal(
    h.getScheduled().some((n) => n.content.data.occurrenceKey === target),
    false,
  );
});
test('revoked notification permission prevents scheduling and preserves existing user preference', async () => {
  const h = harness();
  h.setAllowed(false);
  assert.equal(await h.service.rescheduleReminders([], [], []), 0);
  assert.equal(h.getCanceled(), 0);
});
