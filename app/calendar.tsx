import { OrbitalBackground } from '@/components/OrbitalBackground';
import { RetryNotice } from '@/components/RetryNotice';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, layout, radius, spacing, typography } from '@/theme';
import { PulseMenu } from '@/components/PulseMenu';
import {
  listProtocolItems,
  listProtocols,
  type TodayItem,
} from '@/services/pulse';
import {
  buildCalendarPreview,
  connectCalendar,
  disconnectCalendar,
  readCalendarConnection,
  requestWritableCalendars,
  setCalendarTitlePrivacy,
  syncCalendarEvents,
  type CalendarConnection,
  type WritableCalendar,
} from '@/services/calendarSync';

type TrackedProtocol = {
  id: string;
  name: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
};

export default function CalendarScreen() {
  const router = useRouter();
  const [items, setItems] = useState<TodayItem[]>([]);
  const [protocols, setProtocols] = useState<TrackedProtocol[]>([]);
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [calendars, setCalendars] = useState<WritableCalendar[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const canChangeCalendar =
    loaded && !loading && !loadError && Platform.OS !== 'web';

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [nextItems, nextProtocols, nextConnection] = await Promise.all([
        listProtocolItems(),
        listProtocols(),
        readCalendarConnection(),
      ]);
      setItems(nextItems);
      setProtocols(nextProtocols);
      setConnection(nextConnection);
      setLoaded(true);
    } catch (error) {
      setLoadError(
        'Your routine or calendar connection could not load. Retry before syncing. No calendar events were changed.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const preview = useMemo(
    () => buildCalendarPreview(items, protocols, 90),
    [items, protocols],
  );

  async function chooseCalendarAccess() {
    if (busy || !canChangeCalendar) return;
    try {
      setBusy(true);
      const next = await requestWritableCalendars();
      setCalendars(next);
      if (!next.length)
        Alert.alert(
          'No writable calendars',
          'Add a calendar account in device Settings, then try again.',
        );
    } catch (error) {
      Alert.alert(
        'Calendar permission or native build needed',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function selectCalendar(calendar: WritableCalendar) {
    if (busy || !canChangeCalendar) return;
    try {
      setBusy(true);
      const nextConnection = await connectCalendar(calendar);
      setConnection(nextConnection);
      setCalendars([]);
      const result = await syncCalendarEvents(preview);
      setConnection(await readCalendarConnection());
      Alert.alert(
        'Calendar connected and synced',
        `${result.added} scheduled entries added to ${calendar.title}.`,
      );
    } catch (error) {
      Alert.alert(
        'Unable to connect calendar',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function setNames(includeNames: boolean) {
    if (busy || !canChangeCalendar) return;
    try {
      setBusy(true);
      setConnection(await setCalendarTitlePrivacy(includeNames));
      if (connection) {
        await syncCalendarEvents(preview);
        setConnection(await readCalendarConnection());
      }
    } catch (error) {
      Alert.alert(
        'Unable to update privacy',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function runSync() {
    if (busy || !canChangeCalendar) return;
    try {
      setBusy(true);
      const result = await syncCalendarEvents(preview);
      setConnection(await readCalendarConnection());
      Alert.alert(
        'Calendar updated',
        `${result.added} added · ${result.updated} updated · ${result.removed} removed.`,
      );
    } catch (error) {
      Alert.alert(
        'Calendar sync stopped',
        `${error instanceof Error ? error.message : String(error)}\n\nPreviously saved entries are retained so a retry cannot silently create duplicates.`,
      );
      try {
        setConnection(await readCalendarConnection());
      } catch {
        /* Keep current connection display on failed sync. */
      }
    } finally {
      setBusy(false);
    }
  }

  function confirmDisconnect() {
    if (busy) return;
    Alert.alert(
      'Disconnect calendar',
      'Choose what happens to the calendar entries Pulse created. Your other events are never changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Keep events & disconnect',
          onPress: () => {
            void finishDisconnect(false);
          },
        },
        {
          text: 'Remove Pulse events & disconnect',
          style: 'destructive',
          onPress: () => {
            void finishDisconnect(true);
          },
        },
      ],
    );
  }

  async function finishDisconnect(removeEvents: boolean) {
    if (busy) return;
    try {
      setBusy(true);
      await disconnectCalendar(removeEvents);
      setConnection(null);
      setCalendars([]);
      Alert.alert(
        'Calendar disconnected',
        removeEvents
          ? 'Pulse-created calendar entries have been removed.'
          : 'Existing calendar entries were kept. Pulse will no longer manage them.',
      );
    } catch (error) {
      Alert.alert(
        'Could not disconnect safely',
        error instanceof Error ? error.message : String(error),
      );
      try {
        setConnection(await readCalendarConnection());
      } catch {
        /* Preserve last known connection. */
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <OrbitalBackground />
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <PulseMenu />
        <Text style={styles.kicker}>PULSE / CONNECTED TOOLS</Text>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.body}>
          Keep your schedule within reach. You choose if and when Pulse writes
          to your device calendar.
        </Text>
        {!!loadError && (
          <RetryNotice
            title="Calendar could not load"
            message={loadError}
            onRetry={() => void refresh()}
            busy={loading || busy}
          />
        )}
        {Platform.OS === 'web' && (
          <Text style={styles.detail}>
            Device calendar sync is available in Pulse on iOS and Android.
          </Text>
        )}

        <View style={styles.card}>
          <Text style={styles.eyebrow}>YOUR CONNECTION</Text>
          <Text style={styles.heading}>
            {loading
              ? 'Loading connection…'
              : loaded
                ? connection
                  ? connection.calendarName
                  : 'Not connected'
                : 'Connection unavailable'}
          </Text>
          <Text style={styles.detail}>
            {connection
              ? `${Object.keys(connection.events).length} Pulse-created entries currently tracked on this device.`
              : 'Calendar access is never requested until you explicitly connect.'}
          </Text>
          {!connection ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy || !canChangeCalendar}
              accessibilityState={{ disabled: busy || !canChangeCalendar }}
              style={[styles.primary, !canChangeCalendar && { opacity: 0.5 }]}
              onPress={() => void chooseCalendarAccess()}
            >
              <Text style={styles.primaryText}>
                {busy ? 'CONNECTING…' : 'CHOOSE MY CALENDAR'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              style={styles.secondary}
              onPress={confirmDisconnect}
            >
              <Text style={styles.secondaryText}>DISCONNECT CALENDAR</Text>
            </Pressable>
          )}
        </View>

        {calendars.length > 0 && !connection ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              WRITABLE CALENDARS ON THIS DEVICE
            </Text>
            {calendars.map((calendar) => (
              <Pressable
                accessibilityRole="button"
                key={calendar.id}
                style={styles.choice}
                onPress={() => void selectCalendar(calendar)}
                disabled={busy || !canChangeCalendar}
              >
                <Text style={styles.choiceText}>{calendar.title}</Text>
                <Text style={styles.choiceArrow}>↗</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {connection ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>PRIVACY FIRST</Text>
            <Text style={styles.heading}>Event titles</Text>
            <Text style={styles.detail}>
              Generic names are used by default so the lock screen and other
              calendar apps don't reveal substance names.
            </Text>
            <View style={styles.options}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: !connection.includeNames }}
                style={[
                  styles.option,
                  !connection.includeNames && styles.optionActive,
                ]}
                disabled={busy || !canChangeCalendar}
                onPress={() => void setNames(false)}
              >
                <Text
                  style={[
                    styles.optionText,
                    !connection.includeNames && styles.selectedText,
                  ]}
                >
                  Private · Generic
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: connection.includeNames }}
                style={[
                  styles.option,
                  connection.includeNames && styles.optionActive,
                ]}
                disabled={busy || !canChangeCalendar}
                onPress={() => void setNames(true)}
              >
                <Text
                  style={[
                    styles.optionText,
                    connection.includeNames && styles.selectedText,
                  ]}
                >
                  Include names
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.eyebrow}>UPCOMING SCHEDULE / PREVIEW</Text>
          <Text style={styles.heading}>
            {loaded ? preview.length : '—'} scheduled entries
          </Text>
          <Text style={styles.detail}>
            Only active protocol items with valid clock times are included.
            As-needed items are excluded. Sync covers the full remaining
            protocol end date (up to 2 years). Ongoing schedules sync the next
            90 days. Refresh after changing a schedule.
          </Text>
          {preview.slice(0, 5).map((event) => (
            <View key={event.key} style={styles.previewRow}>
              <View style={styles.previewDot} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.previewTitle}>
                  {connection?.includeNames ? event.name : 'Scheduled entry'}
                </Text>
                <Text style={styles.previewTime}>
                  {event.startDate.toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          ))}
          {preview.length > 5 ? (
            <Text style={styles.moreText}>
              + {preview.length - 5} MORE SCHEDULED
            </Text>
          ) : null}
          {connection ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy || !canChangeCalendar}
              style={styles.primary}
              onPress={() => void runSync()}
            >
              <Text style={styles.primaryText}>
                {busy ? 'SYNCING…' : 'REFRESH CALENDAR SYNC'}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.footnote}>
              Connect a calendar above to enable syncing.
            </Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          style={styles.back}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← BACK TO PULSE</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: layout.pageBottom },
  kicker: {
    ...typography.eyebrow,
    color: colors.accent,
    marginTop: spacing.md,
  },
  title: { ...typography.pageTitle, color: colors.text, marginTop: spacing.sm },
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  card: {
    padding: layout.cardInset,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    borderRadius: 0,
    gap: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  heading: { ...typography.cardTitle, color: colors.text },
  detail: { ...typography.detail, color: colors.muted },
  primary: {
    minHeight: 49,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
  },
  primaryText: { ...typography.button, color: colors.bg },
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  secondaryText: { ...typography.button, color: colors.muted },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 49,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  choiceText: { ...typography.label, color: colors.text, flex: 1 },
  choiceArrow: { color: colors.accent, fontSize: 19 },
  options: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    minHeight: 48,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  optionText: { ...typography.label, color: colors.muted },
  selectedText: { color: colors.accent },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  previewTitle: { ...typography.label, color: colors.text },
  previewTime: { ...typography.detail, color: colors.muted, marginTop: 3 },
  moreText: { ...typography.caption, color: colors.subtle },
  footnote: { ...typography.detail, color: colors.muted },
  back: { minHeight: 44, justifyContent: 'center', marginTop: 10 },
  backText: { ...typography.button, color: colors.accent },
});
