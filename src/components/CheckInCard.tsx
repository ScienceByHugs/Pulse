import { RetryNotice } from './RetryNotice';
import { FormSheet } from './FormSheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ProtocolDatePicker } from './ProtocolPickers';
import {
  listCheckIns,
  saveCheckIn,
  deleteCheckIn,
  type CheckIn,
} from '@/services/checkins';
import { localDateKey } from '@/domain/schedule';
import { useAuth } from '@/providers/AuthProvider';
import { colors, layout, radius } from '@/theme';
export function CheckInCard() {
  const { session } = useAuth();
  const ownerId = session?.user.id;
  const owner = useRef(ownerId);
  owner.current = ownerId;
  const request = useRef(0);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(localDateKey());
  const [sleep, setSleep] = useState('');
  const [energy, setEnergy] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [retrySave, setRetrySave] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [rows, setRows] = useState<CheckIn[]>([]);
  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setLoadError('');
    try {
      if (!ownerId) throw new Error('Sign in to load your check-ins.');
      const next = await listCheckIns(undefined, undefined, ownerId);
      if (owner.current !== ownerId || request.current !== current) return null;
      setRows(next);
      return next;
    } catch {
      if (owner.current === ownerId && request.current === current)
        setLoadError(
          'Your check-ins could not load. Retry before editing, so saved observations are preserved.',
        );
      return null;
    } finally {
      if (owner.current === ownerId && request.current === current)
        setLoading(false);
    }
  }, [ownerId]);
  useEffect(() => {
    setOpen(false);
    setRows([]);
    setDirty(false);
    setSleep('');
    setEnergy(null);
    setMood(null);
    setNotes('');
  }, [ownerId]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        request.current += 1;
        setOpen(false);
        setLoading(false);
      };
    }, [load]),
  );
  function edit(day = localDateKey(), available = rows) {
    setSaveError('');
    setRetrySave(false);
    const entry = available.find((r) => r.local_date === day);
    setDate(day);
    setSleep(
      entry?.sleep === null || entry?.sleep === undefined
        ? ''
        : String(entry.sleep),
    );
    setEnergy(entry?.energy ?? null);
    setMood(entry?.mood ?? null);
    setNotes(entry?.notes ?? '');
    setDirty(false);
  }
  async function openForDate(day: string) {
    if (busy || loading) return;
    if (dirty && open && day !== date) {
      setRetrySave(false);
      setSaveError(
        'Save or discard your changes before choosing another date.',
      );
      return;
    }
    const next = await load();
    if (!next || owner.current !== ownerId) return;
    edit(day, next);
    setOpen(true);
  }
  async function save() {
    if (busy || loading || loadError || !ownerId) return;
    setSaveError('');
    setRetrySave(false);
    setBusy(true);
    try {
      await saveCheckIn(
        {
          local_date: date,
          sleep: sleep.trim() ? Number(sleep) : null,
          energy,
          mood,
          notes: notes.trim() || null,
        },
        ownerId,
      );
      if (owner.current !== ownerId) return;
      setDirty(false);
      setOpen(false);
      await load();
    } catch (e) {
      setRetrySave(true);
      setSaveError(
        e instanceof Error ? e.message : 'Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  const today = rows.find((r) => r.local_date === localDateKey());
  const existing = rows.find((r) => r.local_date === date);
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>How’s your day?</Text>
        <Text style={styles.detail}>
          {loading
            ? 'Loading your saved check-ins…'
            : loadError
              ? 'Your saved observations need to load before editing.'
              : today
                ? 'Your check-in is saved. You can edit it whenever you need.'
                : 'An optional moment to record sleep, energy, mood or a note.'}
        </Text>
        {!!loadError && (
          <RetryNotice
            title="Check-ins unavailable"
            message={loadError}
            onRetry={() => void load()}
            busy={loading}
          />
        )}
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          disabled={busy || loading || !!loadError}
          accessibilityState={{ disabled: busy || loading || !!loadError }}
          onPress={() => void openForDate(localDateKey())}
        >
          <Text style={styles.action}>
            {today ? 'Edit today’s check-in' : 'Add a check-in'}
          </Text>
        </Pressable>
      </View>
      <FormSheet
        label={'Daily check-in'}
        visible={open}
        onClose={() => {
          request.current += 1;
          setOpen(false);
          setLoading(false);
        }}
        busy={busy}
      >
        {!!loadError && (
          <RetryNotice
            title="Check-ins unavailable"
            message={loadError}
            busy={loading}
            onRetry={() => void load()}
          />
        )}
        {!!saveError && (
          <RetryNotice
            title="Check-in needs attention"
            message={saveError}
            busy={busy}
            onRetry={retrySave && !loadError ? () => void save() : undefined}
          />
        )}

        <Text style={styles.detail}>
          Everything is optional. These are personal observations, not clinical
          scores.
        </Text>
        <ProtocolDatePicker
          label="Check-in date"
          value={date}
          disabled={busy || loading}
          onChange={(day) => void openForDate(day)}
        />
        <Text style={styles.label}>Sleep (hours)</Text>
        <TextInput
          accessibilityLabel="Hours slept, optional"
          keyboardType="decimal-pad"
          value={sleep}
          editable={!busy && !loading}
          onChangeText={(value) => {
            setSleep(value);
            setDirty(true);
          }}
          placeholder="Leave blank if you prefer"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        {(['energy', 'mood'] as const).map((kind) => (
          <View key={kind}>
            <Text style={styles.label}>
              {kind === 'energy' ? 'Energy' : 'Mood'} · 1 very low, 5 very high
            </Text>
            <View style={styles.row}>
              {[1, 2, 3, 4, 5].map((score) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || loading}
                  accessibilityLabel={`${kind} ${score}`}
                  accessibilityState={{
                    selected: (kind === 'energy' ? energy : mood) === score,
                  }}
                  key={score}
                  style={[
                    styles.score,
                    (kind === 'energy' ? energy : mood) === score &&
                      styles.selected,
                  ]}
                  onPress={() => {
                    setDirty(true);
                    kind === 'energy'
                      ? setEnergy(energy === score ? null : score)
                      : setMood(mood === score ? null : score);
                  }}
                >
                  <Text style={styles.action}>{score}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          accessibilityLabel="Check-in notes, optional"
          multiline
          maxLength={2000}
          editable={!busy && !loading}
          value={notes}
          onChangeText={(value) => {
            setNotes(value);
            setDirty(true);
          }}
          style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
        />
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          disabled={busy || loading || !!loadError}
          onPress={() => void save()}
        >
          <Text style={styles.action}>
            {busy ? 'Saving…' : 'Save check-in'}
          </Text>
        </Pressable>
        {dirty && (
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            disabled={busy || loading}
            onPress={() => edit(date)}
          >
            <Text style={styles.action}>Discard unsaved changes</Text>
          </Pressable>
        )}
        {existing && (
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            disabled={busy || loading || !!loadError}
            onPress={() =>
              Alert.alert(
                'Delete this check-in?',
                'This removes only your observations for this date.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      setBusy(true);
                      void deleteCheckIn(existing.id)
                        .then(load)
                        .then(() => {
                          edit(date);
                          setOpen(false);
                        })
                        .catch(() =>
                          Alert.alert('Could not delete', 'Try again.'),
                        )
                        .finally(() => setBusy(false));
                    },
                  },
                ],
              )
            }
          >
            <Text style={styles.action}>Delete check-in</Text>
          </Pressable>
        )}
      </FormSheet>
    </>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: 40, gap: 16 },
  card: {
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    gap: 8,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  detail: { color: colors.muted, lineHeight: 20 },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  score: {
    width: 44,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.panel2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selected: { borderWidth: 1, borderColor: colors.accent },
  button: {
    minHeight: 44,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
  },
  action: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  input: {
    padding: 14,
    color: colors.text,
    backgroundColor: colors.panel2,
    borderRadius: radius.md,
    fontSize: 16,
  },
});
