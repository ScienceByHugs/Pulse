import {
  entryName,
  wallTimeToInstant,
  zonedDateKey,
} from '@/domain/occurrences';
import { SheetHeader } from './SheetHeader';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProtocolDatePicker, ProtocolTimePicker } from './ProtocolPickers';
import { localDateKey } from '@/domain/schedule';
import {
  correctDoseLog,
  undoDoseLog,
  type TimelineEntry,
} from '@/services/pulse';
import { colors, radius, spacing } from '@/theme';

export function LogEditor({
  entry,
  onClose,
  onSaved,
}: {
  entry: TimelineEntry;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const originalDate = new Date(entry.logged_at);
  const [amount, setAmount] = useState(String(entry.amount));
  const zone =
    entry.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const originalKey = zonedDateKey(originalDate, zone);
  const originalClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(originalDate);
  const [date, setDate] = useState(originalKey);
  const [time, setTime] = useState(originalClock);
  const [site, setSite] = useState(entry.site ?? '');
  const [busy, setBusy] = useState(false);
  async function save(undo = false) {
    if (busy) return;
    try {
      setBusy(true);
      if (undo) await undoDoseLog(entry);
      else {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0)
          throw new Error('Enter a positive amount.');
        if (!date || !time) throw new Error('Choose a date and time.');
        // Preserve the exact original instant unless the user changes its local date/time.
        const unchanged = date === originalKey && time === originalClock;
        const instant = wallTimeToInstant(date, time, zone);
        if (!instant)
          throw new Error(
            'This time does not exist on the daylight-saving change date. Choose another time.',
          );
        const loggedAt = unchanged ? entry.logged_at : instant.toISOString();
        await correctDoseLog(entry, {
          amount: value,
          loggedAt,
          site: site.trim() || null,
          status: entry.status === 'skipped' ? 'skipped' : 'completed',
        });
      }
      await onSaved();
      onClose();
    } catch (error) {
      Alert.alert(
        'Could not update entry',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.page}
          >
            <View style={styles.card}>
              <SheetHeader
                label="Edit entry"
                disabled={busy}
                onClose={onClose}
              />
              <Text style={styles.title}>{entryName(entry)}</Text>
              <Text style={styles.body}>
                {entry.status === 'skipped'
                  ? 'Skipped entry · no inventory consumed.'
                  : 'Amount changes adjust the original container’s inventory automatically.'}
              </Text>
              <Text style={styles.label}>
                {entry.status === 'skipped'
                  ? 'Scheduled amount'
                  : 'Recorded amount'}{' '}
                · {entry.unit}
              </Text>
              <TextInput
                accessibilityLabel={`Recorded amount in ${entry.unit}`}
                style={styles.input}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
              <ProtocolDatePicker
                label="Recorded date"
                value={date}
                onChange={setDate}
              />
              <ProtocolTimePicker
                label="Recorded time"
                value={time}
                onChange={setTime}
              />
              <Text style={styles.body}>
                Times use the original record’s time zone: {zone}.
              </Text>
              <TextInput
                accessibilityLabel="Recorded site"
                style={styles.input}
                value={site}
                onChangeText={setSite}
                maxLength={100}
                placeholder="Site · optional"
                placeholderTextColor={colors.muted}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                style={styles.primary}
                onPress={() => void save()}
              >
                <Text style={styles.primaryText}>
                  {busy ? 'Saving…' : 'Save changes'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                style={styles.close}
                onPress={() =>
                  Alert.alert(
                    'Undo this entry?',
                    'Remove it from your active history and restore any inventory it used. The correction record is retained.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Undo entry', onPress: () => void save(true) },
                    ],
                  )
                }
              >
                <Text style={styles.label}>Undo entry</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: spacing.md, paddingBottom: 32 },
  card: {
    padding: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  close: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  body: { color: colors.muted, lineHeight: 21 },
  input: {
    color: colors.text,
    backgroundColor: colors.panel2,
    padding: 14,
    borderRadius: radius.md,
    fontSize: 16,
  },
  primary: {
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryText: { color: '#03111f', fontWeight: '900' },
});
