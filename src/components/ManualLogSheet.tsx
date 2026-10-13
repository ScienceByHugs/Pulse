import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormSheet } from './FormSheet';
import { RetryNotice } from './RetryNotice';
import { quickLog, type TodayItem } from '@/services/pulse';
import { useAuth } from '@/providers/AuthProvider';
import { readOutbox } from '@/lib/outbox';
import { administrationLabel } from '@/domain/administration';
import { sitesForRoute } from '@/domain/sites';
import { colors, radius, typography } from '@/theme';
export function ManualLogSheet({
  item,
  onClose,
  onSaved,
}: {
  item: TodayItem;
  onClose: () => void;
  onSaved: (queued: boolean) => void;
}) {
  const { session } = useAuth();
  const [amount, setAmount] = useState(String(item.dose_amount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [held, setHeld] = useState(false);
  const [site, setSite] = useState('');
  const [showSites, setShowSites] = useState(false);
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
      const result = await quickLog(
        { ...item, dose_amount: actual },
        site || undefined,
      );
      onSaved(result.queued);
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
      {sitesForRoute(item.route).length > 0 && (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Injection site: ${site || 'Not recorded'}`}
            accessibilityState={{ expanded: showSites, disabled: busy || held }}
            disabled={busy || held}
            onPress={() => setShowSites((value) => !value)}
            style={styles.siteOption}
          >
            <Text style={styles.detail}>
              {site || 'Select site (optional)'} {showSites ? '▴' : '▾'}
            </Text>
          </Pressable>
          {showSites &&
            ['', ...sitesForRoute(item.route)].map((value) => (
              <Pressable
                key={value || 'none'}
                accessibilityRole="button"
                accessibilityState={{
                  selected: site === value,
                  disabled: busy || held,
                }}
                disabled={busy || held}
                onPress={() => {
                  setSite(value);
                  setShowSites(false);
                }}
                style={styles.siteOption}
              >
                <Text style={styles.detail}>
                  {value || 'No site recorded'}
                  {site === value ? ' ✓' : ''}
                </Text>
              </Pressable>
            ))}
        </View>
      )}
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
  title: { ...typography.sectionTitle, color: colors.text },
  label: { ...typography.label, color: colors.text },
  detail: { ...typography.body, color: colors.muted },
  input: {
    ...typography.input,
    color: colors.text,
    backgroundColor: colors.panel2,
    padding: 16,
    borderRadius: radius.md,
  },
  button: {
    minHeight: 48,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  action: { ...typography.button, color: colors.bg },
  siteOption: {
    minHeight: 44,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: colors.panel2,
    borderRadius: radius.md,
  },
});
