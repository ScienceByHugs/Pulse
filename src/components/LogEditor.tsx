import {
  entryName,
  wallTimeToInstant,
  zonedDateKey,
  validTimeZone,
} from '@/domain/occurrences';
import { FormSheet } from './FormSheet';
import { RetryNotice } from './RetryNotice';
import { sitesForRoute } from '@/domain/sites';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ProtocolDatePicker, ProtocolTimePicker } from './ProtocolPickers';
import {
  correctDoseLog,
  undoDoseLog,
  type TimelineEntry,
} from '@/services/pulse';
import { colors, radius } from '@/theme';

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
    entry.time_zone && validTimeZone(entry.time_zone)
      ? entry.time_zone
      : Intl.DateTimeFormat().resolvedOptions().timeZone;
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
  const [showSites, setShowSites] = useState(false);
  const [status, setStatus] = useState<'completed' | 'skipped' | null>(
    entry.status === 'completed' || entry.status === 'skipped'
      ? entry.status
      : null,
  );
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(undo = false) {
    if (busy) return;
    try {
      setBusy(true);
      setSaveError('');
      if (undo) await undoDoseLog(entry);
      else {
        if (!status)
          throw new Error('Choose whether this entry was recorded or skipped.');
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
          status,
        });
      }
      await onSaved();
      onClose();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Could not confirm the update. Close and review your Timeline before trying again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormSheet label="Edit entry" busy={busy} onClose={onClose}>
      <View style={styles.card}>
        <Text style={styles.title}>{entryName(entry)}</Text>
        <Text style={styles.body}>
          {status === 'skipped'
            ? 'Skipped entry · no inventory consumed.'
            : 'Amount changes adjust the original container’s inventory automatically.'}
        </Text>
        <Text style={styles.label}>Entry status</Text>
        <View style={styles.header}>
          {(['completed', 'skipped'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{
                selected: status === value,
                disabled: busy,
              }}
              disabled={busy}
              onPress={() => setStatus(value)}
              style={[
                styles.close,
                status === value && {
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.accentBorder,
                },
              ]}
            >
              <Text style={styles.label}>
                {value === 'completed' ? 'Recorded' : 'Skipped'}
              </Text>
            </Pressable>
          ))}
        </View>
        {!status && (
          <Text style={styles.body}>
            Choose what happened before saving a correction.
          </Text>
        )}
        <Text style={styles.label}>
          {status === 'skipped' ? 'Scheduled amount' : 'Recorded amount'} ·{' '}
          {entry.unit}
        </Text>
        <TextInput
          accessibilityLabel={`${status === 'skipped' ? 'Scheduled' : 'Recorded'} amount in ${entry.unit}`}
          style={styles.input}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          editable={!busy}
        />
        <ProtocolDatePicker
          label="Recorded date"
          disabled={busy}
          value={date}
          onChange={(value) => {
            if (!busy) setDate(value);
          }}
        />
        <ProtocolTimePicker
          label="Recorded time"
          disabled={busy}
          value={time}
          onChange={(value) => {
            if (!busy) setTime(value);
          }}
        />
        <Text style={styles.body}>
          Times use the original record’s time zone: {zone}.
        </Text>
        {sitesForRoute(entry.route ?? '').length ? (
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Recorded injection site: ${site || 'Not recorded'}`}
              accessibilityState={{ expanded: showSites, disabled: busy }}
              disabled={busy}
              onPress={() => setShowSites((value) => !value)}
              style={styles.close}
            >
              <Text style={styles.body}>
                {site || 'Select site (optional)'} {showSites ? '▴' : '▾'}
              </Text>
            </Pressable>
            {showSites &&
              [...new Set(['', ...sitesForRoute(entry.route ?? ''), site])].map(
                (value) => (
                  <Pressable
                    key={value || 'none'}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: site === value,
                      disabled: busy,
                    }}
                    disabled={busy}
                    onPress={() => {
                      setSite(value);
                      setShowSites(false);
                    }}
                    style={styles.close}
                  >
                    <Text style={styles.body}>
                      {value || 'No site recorded'}
                      {site === value ? ' ✓' : ''}
                    </Text>
                  </Pressable>
                ),
              )}
          </View>
        ) : (
          <TextInput
            accessibilityLabel="Recorded site"
            style={styles.input}
            value={site}
            onChangeText={setSite}
            maxLength={100}
            placeholder="Site · optional"
            placeholderTextColor={colors.muted}
            editable={!busy}
          />
        )}
        {!!saveError && (
          <RetryNotice title="Could not update entry" message={saveError} />
        )}
        <Pressable
          accessibilityRole="button"
          disabled={busy || !status}
          accessibilityState={{ disabled: busy || !status, busy }}
          style={[styles.primary, (busy || !status) && { opacity: 0.5 }]}
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
    </FormSheet>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
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
