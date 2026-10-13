import { SheetHeader } from './SheetHeader';
import { colors } from '@/theme';
import { useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const ink = colors.text;
const bg = colors.panel;
const cyan = colors.accent;
const pad = (n: number) => String(n).padStart(2, '0');
export function displayProtocolDate(iso: string | null | undefined) {
  if (!iso) return 'Not set';
  const [y = 0, m = 0, d = 0] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toLocaleDateString('en-US', { weekday: 'long' })}, ${pad(m)}/${pad(d)}/${y}`;
}

export function ProtocolDatePicker({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const [y, m] = value.split('-').map(Number);
    return new Date(
      y || new Date().getFullYear(),
      (m || new Date().getMonth() + 1) - 1,
      1,
      12,
    );
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const length = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1).getDay();
  const shift = (by: number) => setCursor(new Date(year, month + by, 1, 12));
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${label}`}
        style={styles.control}
        onPress={() => {
          const [y, m] = value.split('-').map(Number);
          setCursor(
            new Date(
              y || new Date().getFullYear(),
              (m || new Date().getMonth() + 1) - 1,
              1,
              12,
            ),
          );
          Keyboard.dismiss();
          setOpen(true);
        }}
      >
        <Text style={styles.controlLabel}>{label}</Text>
        <Text style={styles.value}>{displayProtocolDate(value)} ▾</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <SheetHeader label={label} onClose={() => setOpen(false)} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 12 }}
            >
              <View style={styles.monthRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  onPress={() => shift(-1)}
                  style={styles.arrow}
                >
                  <Text style={styles.value}>‹</Text>
                </Pressable>
                <Text style={styles.heading}>
                  {cursor.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  onPress={() => shift(1)}
                  style={styles.arrow}
                >
                  <Text style={styles.value}>›</Text>
                </Pressable>
              </View>
              <View style={styles.days}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <Text key={d} style={styles.dayName}>
                    {d}
                  </Text>
                ))}
              </View>
              <View style={styles.days}>
                {Array.from({ length: first + length }, (_, i) => {
                  const day = i - first + 1;
                  if (day < 1) return <View key={i} style={styles.dayCell} />;
                  const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
                  return (
                    <Pressable
                      key={iso}
                      accessibilityRole="button"
                      accessibilityLabel={iso}
                      onPress={() => {
                        onChange(iso);
                        setOpen(false);
                      }}
                      style={[styles.dayCell, iso === value && styles.selected]}
                    >
                      <Text style={styles.value}>{day}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {optional ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  style={styles.action}
                >
                  <Text style={styles.value}>Clear date</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={styles.action}
              >
                <Text style={styles.value}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function ProtocolTimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'12' | '24'>('12');
  const [hour, setHour] = useState(() => Number(value.split(':')[0] || 8));
  const [minute, setMinute] = useState(() => Number(value.split(':')[1] || 0));
  const [period, setPeriod] = useState<'AM' | 'PM'>(() =>
    Number(value.split(':')[0] || 8) >= 12 ? 'PM' : 'AM',
  );
  const showHour = mode === '24' ? hour : hour % 12 || 12;
  const hours =
    mode === '24'
      ? Array.from({ length: 24 }, (_, i) => i)
      : Array.from({ length: 12 }, (_, i) => i + 1);
  const selectHour = (h: number) =>
    setHour(mode === '24' ? h : (h % 12) + (period === 'PM' ? 12 : 0));
  const changePeriod = (p: 'AM' | 'PM') => {
    setPeriod(p);
    setHour((hour % 12) + (p === 'PM' ? 12 : 0));
  };
  const formatted = value
    ? mode === '24'
      ? value
      : `${Number(value.slice(0, 2)) % 12 || 12}:${value.slice(3, 5)} ${Number(value.slice(0, 2)) >= 12 ? 'PM' : 'AM'}`
    : 'Not set';
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${label}`}
        style={styles.control}
        onPress={() => {
          const h = Number(value.split(':')[0] || 8),
            m = Number(value.split(':')[1] || 0);
          setHour(h);
          setMinute(m);
          setPeriod(h >= 12 ? 'PM' : 'AM');
          Keyboard.dismiss();
          setOpen(true);
        }}
      >
        <Text style={styles.controlLabel}>{label}</Text>
        <Text style={styles.value}>{formatted} ▾</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <SheetHeader label={label} onClose={() => setOpen(false)} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 12 }}
            >
              <View style={styles.monthRow}>
                {(['12', '24'] as const).map((m) => (
                  <Pressable
                    accessibilityRole="button"
                    key={m}
                    style={[styles.option, mode === m && styles.selected]}
                    onPress={() => setMode(m)}
                  >
                    <Text style={styles.value}>
                      {m === '12' ? '12-hour (AM/PM)' : '24-hour'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.heading}>
                {mode === '24' ? pad(hour) : showHour}:{pad(minute)}{' '}
                {mode === '12' ? period : ''}
              </Text>
              <Text style={styles.controlLabel}>Hour</Text>
              <ScrollView horizontal style={styles.hourScroll}>
                {hours.map((h) => (
                  <Pressable
                    accessibilityRole="button"
                    key={h}
                    style={[styles.option, showHour === h && styles.selected]}
                    onPress={() => selectHour(h)}
                  >
                    <Text style={styles.value}>{pad(h)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.controlLabel}>Minute</Text>
              <ScrollView horizontal style={styles.hourScroll}>
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <Pressable
                    accessibilityRole="button"
                    key={m}
                    style={[styles.option, minute === m && styles.selected]}
                    accessibilityLabel={`Minute ${m}`}
                    accessibilityState={{ selected: minute === m }}
                    onPress={() => setMinute(m)}
                  >
                    <Text style={styles.value}>{pad(m)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {mode === '12' ? (
                <View style={styles.monthRow}>
                  {(['AM', 'PM'] as const).map((p) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={p}
                      accessibilityState={{ selected: period === p }}
                      key={p}
                      style={[styles.option, period === p && styles.selected]}
                      onPress={() => changePeriod(p)}
                    >
                      <Text style={styles.value}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                style={[styles.action, styles.selected]}
                onPress={() => {
                  onChange(`${pad(hour)}:${pad(minute)}`);
                  setOpen(false);
                }}
              >
                <Text style={styles.value}>Save time</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.action}
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Text style={styles.value}>Clear time</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.action}
                onPress={() => setOpen(false)}
              >
                <Text style={styles.value}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  control: {
    backgroundColor: bg,
    borderColor: '#344F5E',
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    marginVertical: 5,
    minWidth: 0,
    flexShrink: 1,
  },
  controlLabel: {
    color: '#9AABBA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
    marginBottom: 6,
  },
  value: { color: ink, fontSize: 14, fontWeight: '600' },
  overlay: {
    flex: 1,
    backgroundColor: '#000B',
    justifyContent: 'center',
    padding: 18,
  },
  dialog: {
    backgroundColor: bg,
    borderRadius: 20,
    padding: 18,
    maxHeight: '85%',
  },
  title: { color: ink, fontSize: 21, fontWeight: '800', marginBottom: 12 },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    marginVertical: 9,
  },
  arrow: {
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    color: ink,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 9,
  },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  dayName: {
    width: '14.2857%',
    color: cyan,
    textAlign: 'center',
    paddingVertical: 9,
    fontSize: 11,
  },
  dayCell: {
    width: '14.2857%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  selected: { backgroundColor: colors.accentSoft },
  option: {
    padding: 10,
    borderRadius: 8,
    marginRight: 6,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
  },
  hourScroll: { flexGrow: 0, maxHeight: 58, marginBottom: 10 },
  action: { padding: 12, alignItems: 'center', marginTop: 6, borderRadius: 8 },
});
