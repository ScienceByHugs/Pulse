import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { FormSheet } from './FormSheet';
import { RetryNotice } from './RetryNotice';
import { quickLog, type TodayItem } from '@/services/pulse';
import { useAuth } from '@/providers/AuthProvider';
import { readOutbox } from '@/lib/outbox';
import { administrationLabel } from '@/domain/administration';
import { colors, radius } from '@/theme';
export function ManualLogSheet({
  item,
  onClose,
  onSaved,
}: {
  item: TodayItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const [amount, setAmount] = useState(String(item.dose_amount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [held, setHeld] = useState(false);
  async function save() {
    if (busy || held || !session) return;
    const actual = Number(amount);
    if (!amount.trim() || !Number.isFinite(actual) || actual <= 0) {
      setError('Enter the positive amount you actually recorded.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const pending = await readOutbox(session.user.id);
      if (pending.some((p) => p.protocolItemId === item.id && p.needsReview))
        throw new Error(
          'Resolve the earlier pending entry in Sync status before recording another.',
        );
      await quickLog({ ...item, dose_amount: actual });
      onSaved();
      onClose();
    } catch (e) {
      setHeld(true);
      setError(
        e instanceof Error
          ? e.message
          : 'Could not confirm this entry. Close and check Sync status before recording again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormSheet label="As-needed entry" busy={busy} onClose={onClose}>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.detail}>
        Record activity that happened now. This does not add a recurring
        schedule or reminder. Manual entries appear in Timeline, separate from
        your scheduled daily totals.
      </Text>
      <Text style={styles.label}>Actual amount ({item.dose_unit})</Text>
      <TextInput
        accessibilityLabel={`Actual recorded amount in ${item.dose_unit}`}
        style={styles.input}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        editable={!busy && !held}
      />
      <Text style={styles.detail}>
        {administrationLabel(item.route)} · Your saved administration type
      </Text>
      {!!error && <RetryNotice title="Review this entry" message={error} />}
      <Pressable
        accessibilityRole="button"
        disabled={busy || held}
        style={[styles.button, (busy || held) && { opacity: 0.5 }]}
        onPress={() => void save()}
      >
        <Text style={styles.action}>
          {busy ? 'Saving…' : 'Save manual entry'}
        </Text>
      </Pressable>
    </FormSheet>
  );
}
const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  label: { color: colors.text, fontWeight: '600' },
  detail: { color: colors.muted, lineHeight: 22 },
  input: {
    color: colors.text,
    backgroundColor: colors.panel2,
    padding: 16,
    borderRadius: radius.md,
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  action: { color: colors.bg, fontWeight: '700' },
});
