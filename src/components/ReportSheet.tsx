import { RetryNotice } from './RetryNotice';
import { FormSheet } from './FormSheet';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ProtocolDatePicker } from './ProtocolPickers';
import { shareTrackingReport } from '@/services/reports';
import { localDateKey } from '@/domain/schedule';
import { colors, layout, radius } from '@/theme';
export function ReportSheet() {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(
    localDateKey(new Date(Date.now() - 6 * 86400000)),
  );
  const [end, setEnd] = useState(localDateKey());
  const [logs, setLogs] = useState(true);
  const [checkins, setCheckins] = useState(false);
  const [notes, setNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  async function share() {
    if (busy) return;
    setSaveError('');
    setBusy(true);
    try {
      await shareTrackingReport({
        start,
        end,
        includeLogs: logs,
        includeCheckIns: checkins,
        includeNotes: notes,
      });
      setOpen(false);
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : 'Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={() => {
          setSaveError('');
          setOpen(true);
        }}
      >
        <Text style={styles.action}>Create a shareable report</Text>
      </Pressable>
      <FormSheet
        label={'Your report'}
        visible={open}
        onClose={() => setOpen(false)}
        busy={busy}
      >
        {!!saveError && (
          <RetryNotice
            title="Could not create report"
            message={saveError}
            busy={busy}
            onRetry={() => void share()}
          />
        )}

        <Text style={styles.title}>Choose what to share</Text>
        <Text style={styles.detail}>
          A readable PDF, created on your device. Select the dates and
          observations you want to include. Sharing only happens when you choose
          a destination.
        </Text>
        <ProtocolDatePicker label="From" value={start} onChange={setStart} />
        <ProtocolDatePicker label="Through" value={end} onChange={setEnd} />
        {[
          { label: 'Tracking logs', value: logs, set: setLogs },
          {
            label: 'Sleep, energy & mood',
            value: checkins,
            set: setCheckins,
          },
          { label: 'Recorded notes', value: notes, set: setNotes },
        ].map((row, index) => (
          <View style={styles.row} key={row.label}>
            <Text style={styles.text}>{row.label}</Text>
            <Switch
              value={row.value}
              disabled={index === 2 && !checkins && !logs}
              onValueChange={row.set}
            />
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          disabled={busy}
          onPress={() => void share()}
        >
          <Text style={styles.action}>
            {busy ? 'Creating PDF…' : 'Create & share PDF'}
          </Text>
        </Pressable>
      </FormSheet>
    </>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: 40, gap: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  detail: { color: colors.muted, lineHeight: 20 },
  text: { color: colors.text, fontSize: 15 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  button: {
    minHeight: 44,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    marginVertical: 8,
  },
  action: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
