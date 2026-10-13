import { FormSheet } from './FormSheet';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSync } from '@/providers/SyncProvider';
import { useAuth } from '@/providers/AuthProvider';
import { updateQuickLog, type QuickLogPayload } from '@/lib/outbox';
import { ProtocolDatePicker, ProtocolTimePicker } from './ProtocolPickers';
import { colors, layout, radius } from '@/theme';
import { deviceTimeZone, zonedDateKey } from '@/domain/occurrences';
export function SyncStatus() {
  const sync = useSync();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuickLogPayload | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const reviewed = sync.pending.filter((p) => p.needsReview).length;
  async function saveTime() {
    if (!editing || !session) return;
    try {
      const logged = new Date(`${date}T${time}:00`);
      if (!Number.isFinite(logged.getTime()) || logged > new Date())
        throw new Error('Choose the actual record time, before now.');
      await updateQuickLog(session.user.id, editing.clientEventId, {
        loggedAt: logged.toISOString(),
        localDate: zonedDateKey(logged, deviceTimeZone()),
        timeZone: deviceTimeZone(),
        needsReview: false,
        syncError: undefined,
      });
      setEditing(null);
      await sync.refresh(true);
    } catch (e) {
      Alert.alert(
        'Could not update entry',
        e instanceof Error ? e.message : 'Try again.',
      );
    }
  }
  if (!sync.pending.length && sync.online) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        style={styles.banner}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.text}>
          {sync.syncing
            ? 'Syncing…'
            : reviewed
              ? `${reviewed} pending ${reviewed === 1 ? 'entry needs' : 'entries need'} review`
              : sync.pending.length
                ? `${sync.pending.length} ${sync.pending.length === 1 ? 'entry' : 'entries'} waiting to sync`
                : 'Offline · cached data'}
        </Text>
        <Text style={styles.detail}>View sync status →</Text>
      </Pressable>
      <FormSheet
        label={'Sync status'}
        visible={open}
        onClose={() => {
          setEditing(null);
          setOpen(false);
        }}
        busy={sync.syncing}
      >
        <Text style={styles.detail}>
          Pending records retain the time you recorded them. Pulse retries when
          connected. An Undo request also waits for confirmation from the
          server.
        </Text>
        {sync.pending.map((p) => (
          <View key={p.clientEventId} style={styles.card}>
            <Text style={styles.text}>
              {p.itemName ?? 'Older pending record'}
            </Text>
            <Text style={styles.detail}>
              {p.amount} {p.unit} ·{' '}
              {p.loggedAt
                ? new Date(p.loggedAt).toLocaleString()
                : 'Original time needed'}
            </Text>
            <Text style={styles.detail}>
              {p.undoRequested
                ? 'Undo waiting to sync'
                : p.status === 'skipped'
                  ? 'Skipped · no stock used'
                  : 'Waiting to sync'}
            </Text>
            {p.syncError && <Text style={styles.warning}>{p.syncError}</Text>}
            {!p.undoRequested && (
              <Pressable
                accessibilityRole="button"
                style={styles.button}
                disabled={sync.syncing}
                onPress={() => {
                  if (!session) return;
                  void updateQuickLog(session.user.id, p.clientEventId, {
                    undoRequested: true,
                    needsReview: false,
                    syncError: undefined,
                  })
                    .then(() => sync.refresh())
                    .catch(() =>
                      Alert.alert('Could not request Undo', 'Try again.'),
                    );
                }}
              >
                <Text style={styles.text}>Undo pending entry</Text>
              </Pressable>
            )}
            {!p.loggedAt && !p.undoRequested && (
              <Pressable
                accessibilityRole="button"
                style={styles.button}
                onPress={() => {
                  setEditing(p);
                  setDate(zonedDateKey(new Date(), deviceTimeZone()));
                }}
              >
                <Text style={styles.text}>Set original record time</Text>
              </Pressable>
            )}
          </View>
        ))}
        {editing && (
          <View style={styles.card}>
            <ProtocolDatePicker
              label="Actual record date"
              value={date}
              onChange={setDate}
            />
            <ProtocolTimePicker
              label="Actual record time"
              value={time}
              onChange={setTime}
            />
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => void saveTime()}
            >
              <Text style={styles.text}>Save time & retry</Text>
            </Pressable>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          disabled={sync.syncing}
          onPress={() =>
            void sync
              .refresh(true)
              .catch(() =>
                Alert.alert(
                  'Could not sync',
                  'Check your connection and retry.',
                ),
              )
          }
        >
          <Text style={styles.text}>Retry pending entries</Text>
        </Pressable>
      </FormSheet>
    </>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: 40, gap: 16 },
  banner: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    marginBottom: 14,
    minHeight: 44,
  },
  text: { color: colors.text, fontSize: 15, fontWeight: '600' },
  detail: { color: colors.muted, lineHeight: 20, marginTop: 6 },
  warning: { color: colors.warning, lineHeight: 20, marginTop: 6 },
  card: {
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    gap: 8,
  },
  button: {
    minHeight: 44,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
  },
});
