const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./helpers.cjs');

function harness({ cancelFails = false, scheduleFails = false } = {}) {
  let privateMode = false,
    enabled = true,
    scheduled = [],
    cancelCount = 0,
    dismissed = 0;
  let release, started;
  const firstStarted = new Promise((resolve) => {
    started = resolve;
  });
  const firstRelease = new Promise((resolve) => {
    release = resolve;
  });
  let blockFirst = false,
    scheduleCount = 0;
  const notifications = {
    setNotificationHandler() {},
    dismissAllNotificationsAsync: async () => {
      dismissed++;
    },
    getPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
    cancelAllScheduledNotificationsAsync: async () => {
      cancelCount++;
      if (cancelFails) throw new Error('Cancellation failed');
      scheduled = [];
    },
    scheduleNotificationAsync: async (notification) => {
      scheduleCount++;
      if (blockFirst && scheduleCount === 1) {
        started();
        await firstRelease;
      }
      if (scheduleFails && scheduleCount === 2)
        throw new Error('Scheduling failed');
      scheduled.push(notification);
    },
    SchedulableTriggerInputTypes: { DATE: 'date' },
  };
  const query = {
    select() {
      return this;
    },
    gte() {
      return this;
    },
    in() {
      return this;
    },
    order() {
      return this;
    },
    range: async () => ({ data: [], error: null }),
  };
  const service = loader({
    'react-native': { Platform: { OS: 'ios' } },
    'expo-notifications': notifications,
    '@/lib/supabase': {
      supabase: {
        from: () => query,
        auth: { getSession: async () => ({ data: { session: null } }) },
      },
    },
    '@/lib/outbox': { readOutbox: async () => [] },
    '@/lib/privacy': {
      getPrivateNotifications: async () => privateMode,
      setPrivateNotifications: async (value) => {
        privateMode = value;
      },
      getRemindersEnabled: async () => enabled,
      setRemindersEnabled: async (value) => {
        enabled = value;
      },
    },
  })('src/lib/reminders.ts');
  return {
    service,
    block: () => {
      blockFirst = true;
    },
    firstStarted,
    release: () => release(),
    state: () => ({ privateMode, enabled, scheduled, cancelCount, dismissed }),
  };
}
const item = {
  id: 'fictional',
  name: 'Private fictional substance',
  dose_amount: 1,
  dose_unit: 'unit',
  schedule: { type: 'daily', time: '09:00', timeZone: 'UTC' },
};

test('turning on private text waits for in-flight scheduling, then removes detailed pending alerts even when offline', async () => {
  const h = harness();
  h.block();
  const original = h.service.rescheduleReminders([item], [], []);
  await h.firstStarted;
  const privacy = h.service.setReminderPrivacy(true, async () => {
    throw new Error('Offline');
  });
  const rejected = assert.rejects(privacy, (error) => {
    assert.equal(error.preferenceSaved, true);
    assert.equal(error.pendingCleared, true);
    return /Offline/.test(error.message);
  });
  h.release();
  await original;
  await rejected;
  assert.equal(h.state().privateMode, true);
  assert.equal(h.state().scheduled.length, 0);
  await h.service.rescheduleReminders([item], [], []);
  assert.ok(h.state().scheduled.length > 0);
  assert.ok(
    h.state().scheduled.every((n) => !n.content.body.includes(item.name)),
  );
});

test('privacy is not reported saved if old pending alerts could not be cancelled', async () => {
  const h = harness({ cancelFails: true });
  let refreshed = false;
  await assert.rejects(
    h.service.setReminderPrivacy(true, async () => {
      refreshed = true;
      return [];
    }),
    /Cancellation failed/,
  );
  assert.equal(h.state().privateMode, false);
  assert.equal(refreshed, false);
});

test('failed reminder enable rolls back the preference and removes partial schedules', async () => {
  const h = harness({ scheduleFails: true });
  await assert.rejects(h.service.enableReminders([item]), /Scheduling failed/);
  assert.equal(h.state().enabled, false);
  assert.equal(h.state().scheduled.length, 0);
  assert.ok(h.state().cancelCount >= 2);
});

test('sign-out clears pending alerts after an in-flight update while preserving preference', async () => {
  const h = harness();
  h.block();
  const update = h.service.rescheduleReminders([item], [], []);
  await h.firstStarted;
  const clear = h.service.clearPendingReminders();
  h.release();
  await update;
  await clear;
  assert.equal(h.state().scheduled.length, 0);
  assert.equal(h.state().enabled, true);
  assert.equal(h.state().dismissed, 1);
});
