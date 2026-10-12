import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProtocolDatePicker } from './ProtocolPickers';
import { SheetHeader } from './SheetHeader';
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
  async function share() {
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
      Alert.alert(
        'Could not create report',
        e instanceof Error
          ? e.message
          : ((e as { message?: string })?.message ?? 'Try again.'),
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
        onPress={() => setOpen(true)}
      >
        <Text style={styles.action}>Create a shareable report</Text>
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.page}>
            <SheetHeader
              label="Your report"
              disabled={busy}
              onClose={() => setOpen(false)}
            />
            <Text style={styles.title}>Choose what to share</Text>
            <Text style={styles.detail}>
              A readable PDF, created on your device. Select the dates and
              observations you want to include. Sharing only happens when you
              choose a destination.
            </Text>
            <ProtocolDatePicker
              label="From"
              value={start}
              onChange={setStart}
            />
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
              style={styles.button}
              disabled={busy}
              onPress={() => void share()}
            >
              <Text style={styles.action}>
                {busy ? 'Creating PDF…' : 'Create & share PDF'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
