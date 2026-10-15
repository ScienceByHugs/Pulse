import { RetryNotice } from './RetryNotice';
import { FormSheet } from './FormSheet';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { ProtocolDatePicker } from './ProtocolPickers';
import { shareTrackingReport } from '@/services/reports';
import { localDateKey } from '@/domain/schedule';
import { colors, layout, radius, typography } from '@/theme';
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
  const invalidDateRange = !start || !end || end < start;
  const canCreate = !busy && !invalidDateRange && (logs || checkins);
  async function share() {
    if (!canCreate) return;
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
          setNotes(false);
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
          a destination on your phone. On the web, the PDF downloads to your
          browser.
        </Text>
        <View pointerEvents={busy ? 'none' : 'auto'} style={{ gap: 16 }}>
          <ProtocolDatePicker
            label="From"
            disabled={busy}
            value={start}
            onChange={(value) => {
              if (!busy) setStart(value);
            }}
          />
          <ProtocolDatePicker
            label="Through"
            disabled={busy}
            value={end}
            onChange={(value) => {
              if (!busy) setEnd(value);
            }}
          />
        </View>
        {invalidDateRange && (
          <Text accessibilityLiveRegion="polite" style={styles.detail}>
            Choose a Through date on or after the From date.
          </Text>
        )}
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
              accessibilityLabel={row.label}
              value={row.value}
              disabled={busy || (index === 2 && !checkins && !logs)}
              onValueChange={row.set}
            />
          </View>
        ))}
        {!logs && !checkins && (
          <Text accessibilityLiveRegion="polite" style={styles.detail}>
            Choose tracking logs or daily observations to include.
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          style={[styles.button, !canCreate && { opacity: 0.5 }]}
          disabled={!canCreate}
          accessibilityState={{ disabled: !canCreate, busy }}
          onPress={() => void share()}
        >
          <Text style={styles.action}>
            {busy
              ? 'Creating PDF…'
              : Platform.OS === 'web'
                ? 'Create & download PDF'
                : 'Create & share PDF'}
          </Text>
        </Pressable>
      </FormSheet>
    </>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: 40, gap: 16 },
  title: { ...typography.sectionTitle, color: colors.text },
  detail: { ...typography.body, color: colors.muted },
  text: { ...typography.label, flex: 1, flexShrink: 1, color: colors.text },
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
    marginTop: 0,
    marginBottom: 16,
  },
  action: { ...typography.button, color: colors.accent },
});
