import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
import { SheetHeader } from './SheetHeader';
import { ProtocolDatePicker } from './ProtocolPickers';
import {
  listCheckIns,
  saveCheckIn,
  deleteCheckIn,
  type CheckIn,
} from '@/services/checkins';
import { localDateKey } from '@/domain/schedule';
import { colors, layout, radius } from '@/theme';
export function CheckInCard() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(localDateKey());
  const [sleep, setSleep] = useState('');
  const [energy, setEnergy] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<CheckIn[]>([]);
  const load = useCallback(async () => {
    try {
      setRows(await listCheckIns());
    } catch {
      /* Check-in availability does not block Today. */
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  function edit(day = localDateKey()) {
    const entry = rows.find((r) => r.local_date === day);
    setDate(day);
    setSleep(
      entry?.sleep === null || entry?.sleep === undefined
        ? ''
        : String(entry.sleep),
    );
    setEnergy(entry?.energy ?? null);
    setMood(entry?.mood ?? null);
    setNotes(entry?.notes ?? '');
  }
  async function save() {
    setBusy(true);
    try {
      await saveCheckIn({
        local_date: date,
        sleep: sleep.trim() ? Number(sleep) : null,
        energy,
        mood,
        notes: notes.trim() || null,
      });
      await load();
      setOpen(false);
    } catch (e) {
      Alert.alert(
        'Could not save check-in',
        e instanceof Error
          ? e.message
          : ((e as { message?: string })?.message ?? 'Try again.'),
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
          {today
            ? 'Your check-in is saved. You can edit it whenever you need.'
            : 'An optional moment to record sleep, energy, mood or a note.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => {
            edit();
            setOpen(true);
          }}
        >
          <Text style={styles.action}>
            {today ? 'Edit today’s check-in' : 'Add a check-in'}
          </Text>
        </Pressable>
      </View>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.page}
            >
              <SheetHeader
                label="Daily check-in"
                disabled={busy}
                onClose={() => setOpen(false)}
              />
              <Text style={styles.detail}>
                Everything is optional. These are personal observations, not
                clinical scores.
              </Text>
              <ProtocolDatePicker
                label="Check-in date"
                value={date}
                onChange={edit}
              />
              <Text style={styles.label}>Sleep (hours)</Text>
              <TextInput
                accessibilityLabel="Hours slept, optional"
                keyboardType="decimal-pad"
                value={sleep}
                onChangeText={setSleep}
                placeholder="Leave blank if you prefer"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              {(['energy', 'mood'] as const).map((kind) => (
                <View key={kind}>
                  <Text style={styles.label}>
                    {kind === 'energy' ? 'Energy' : 'Mood'} · 1 very low, 5 very
                    high
                  </Text>
                  <View style={styles.row}>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${kind} ${score}`}
                        accessibilityState={{
                          selected:
                            (kind === 'energy' ? energy : mood) === score,
                        }}
                        key={score}
                        style={[
                          styles.score,
                          (kind === 'energy' ? energy : mood) === score &&
                            styles.selected,
                        ]}
                        onPress={() =>
                          kind === 'energy'
                            ? setEnergy(energy === score ? null : score)
                            : setMood(mood === score ? null : score)
                        }
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
                value={notes}
                onChangeText={setNotes}
                style={[
                  styles.input,
                  { minHeight: 100, textAlignVertical: 'top' },
                ]}
              />
              <Pressable
                style={styles.button}
                disabled={busy}
                onPress={() => void save()}
              >
                <Text style={styles.action}>
                  {busy ? 'Saving…' : 'Save check-in'}
                </Text>
              </Pressable>
              {existing && (
                <Pressable
                  style={styles.button}
                  disabled={busy}
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
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
