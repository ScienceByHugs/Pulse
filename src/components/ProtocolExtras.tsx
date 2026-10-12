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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SheetHeader } from './SheetHeader';
import { ProtocolDatePicker, ProtocolTimePicker } from './ProtocolPickers';
import {
  duplicateProtocol,
  updateInventoryDates,
  type TodayItem,
  type InventorySummary,
} from '@/services/pulse';
import { localDateKey, formatSchedule } from '@/domain/schedule';
import { deviceTimeZone } from '@/domain/occurrences';
import { supplyEstimate, preferredContainer } from '@/domain/inventory';
import { colors, layout, radius } from '@/theme';
export function ScheduleExtras({
  times,
  onTimes,
  zone,
  onZone,
}: {
  times: string[];
  onTimes: (value: string[]) => void;
  zone: string;
  onZone: (value: string) => void;
}) {
  return (
    <View style={styles.stack}>
      {times.map((time, index) => (
        <View key={index} style={styles.row}>
          <View style={{ flex: 1 }}>
            <ProtocolTimePicker
              label={`Additional time ${index + 1}`}
              value={time}
              onChange={(value) =>
                onTimes(times.map((t, i) => (i === index ? value : t)))
              }
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove time ${index + 1}`}
            style={styles.button}
            onPress={() => onTimes(times.filter((_, i) => i !== index))}
          >
            <Text style={styles.action}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {times.length < 7 && (
        <Pressable
          style={styles.button}
          onPress={() => onTimes([...times, '12:00'])}
        >
          <Text style={styles.action}>+ Add another daily time</Text>
        </Pressable>
      )}
      <Text style={styles.detail}>
        Each time gets its own Log, Skip and Undo.
      </Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.text}>Keep my home time zone</Text>
          <Text style={styles.detail}>
            {zone === 'local'
              ? 'Times follow your phone when you travel.'
              : `Times stay in ${zone}.`}
          </Text>
        </View>
        <Switch
          value={zone !== 'local'}
          onValueChange={(value) => onZone(value ? deviceTimeZone() : 'local')}
        />
      </View>
      <Text style={styles.detail}>
        Daylight saving: repeated times occur once; times that do not exist on
        the clock-change day are omitted.
      </Text>
    </View>
  );
}
export function DuplicateProtocolSheet({
  source,
  items,
  onClose,
  onSaved,
}: {
  source: { id: string; name: string } | null;
  items: TodayItem[];
  onClose: () => void;
  onSaved: (newId?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [start, setStart] = useState(localDateKey());
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!source) return;
    setBusy(true);
    try {
      const created = await duplicateProtocol(
        source.id,
        name || `${source.name} copy`,
        start,
        end || null,
      );
      await onSaved(created.id);
      onClose();
    } catch (e) {
      Alert.alert(
        'Could not duplicate',
        e instanceof Error
          ? e.message
          : ((e as { message?: string })?.message ?? 'Try again.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      visible={Boolean(source)}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>
          <SheetHeader
            label="Duplicate protocol"
            disabled={busy}
            onClose={onClose}
          />
          <Text style={styles.title}>Review your new routine</Text>
          <Text style={styles.detail}>
            Copies substances and schedules. Your new protocol starts paused so
            you can review it before activating. Inventory and past logs stay
            with the original.
          </Text>
          <TextInput
            accessibilityLabel="Copied protocol name"
            value={name}
            onChangeText={setName}
            maxLength={100}
            style={styles.input}
            placeholder={source ? `${source.name} copy` : 'Protocol name'}
            placeholderTextColor={colors.muted}
          />
          <ProtocolDatePicker
            label="New start date"
            value={start}
            onChange={setStart}
          />
          <ProtocolDatePicker
            label="New end date (optional)"
            value={end}
            onChange={setEnd}
          />
          {items
            .filter((i) => !i.archived_at && i.protocol_id === source?.id)
            .map((i) => (
              <View key={i.id} style={styles.card}>
                <Text style={styles.text}>
                  {i.name} · {i.dose_amount} {i.dose_unit}
                </Text>
                <Text style={styles.detail}>{formatSchedule(i.schedule)}</Text>
              </View>
            ))}
          <Text style={styles.detail}>
            Interval and cycle anchors reset to the new start date. Temporary
            overrides are cleared.
          </Text>
          <Pressable
            disabled={busy}
            style={styles.button}
            onPress={() => void save()}
          >
            <Text style={styles.action}>
              {busy ? 'Creating…' : 'Create paused copy'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
export function InventoryDetails({
  item,
  container,
  onSaved,
}: {
  item: TodayItem;
  container: InventorySummary;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState('');
  const [expires, setExpires] = useState('');
  const [useBy, setUseBy] = useState('');
  const [lot, setLot] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const chosen = preferredContainer(item)?.id === container.id;
  const passed = Boolean(
    (container.expires_at && new Date(container.expires_at) <= new Date()) ||
      (container.user_use_by_at &&
        new Date(container.user_use_by_at) <= new Date()),
  );
  function edit() {
    setOpened(container.opened_at?.slice(0, 10) ?? '');
    setExpires(container.expires_at?.slice(0, 10) ?? '');
    setUseBy(container.user_use_by_at?.slice(0, 10) ?? '');
    setLot(container.lot_number ?? '');
    setActive(container.is_active);
    setOpen(true);
  }
  async function save() {
    setBusy(true);
    try {
      await updateInventoryDates(container.id, {
        opened_at: opened ? new Date(opened + 'T00:00:00').toISOString() : null,
        expires_at: expires
          ? new Date(expires + 'T23:59:59').toISOString()
          : null,
        user_use_by_at: useBy
          ? new Date(useBy + 'T23:59:59').toISOString()
          : null,
        lot_number: lot.trim() || null,
        is_active: active,
      });
      await onSaved();
      setOpen(false);
    } catch (e) {
      Alert.alert(
        'Could not update container',
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
      <Text style={passed ? styles.warning : styles.detail}>
        {passed
          ? 'Date passed · excluded from logging'
          : chosen
            ? 'Selected for the next log'
            : container.is_active
              ? 'Available stock'
              : 'Inactive container'}
      </Text>
      <Text style={styles.detail}>
        {container.opened_at
          ? `Opened ${container.opened_at.slice(0, 10)} · `
          : ''}
        {container.expires_at
          ? `Expires ${container.expires_at.slice(0, 10)}`
          : 'No expiry entered'}
      </Text>
      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={edit}
      >
        <Text style={styles.action}>Dates & container details</Text>
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
              label="Container details"
              disabled={busy}
              onClose={() => setOpen(false)}
            />
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.detail}>
              Enter dates from your own records or packaging. Pulse does not
              calculate product stability or recommend a use-by date.
            </Text>
            <ProtocolDatePicker
              label="Opened date (optional)"
              value={opened}
              onChange={setOpened}
            />
            <ProtocolDatePicker
              label="Expiry date (optional)"
              value={expires}
              onChange={setExpires}
            />
            <ProtocolDatePicker
              label="Your recorded use-by date (optional)"
              value={useBy}
              onChange={setUseBy}
            />
            <TextInput
              accessibilityLabel="Lot number, optional"
              value={lot}
              onChangeText={setLot}
              maxLength={100}
              style={styles.input}
              placeholder="Lot number (optional)"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.row}>
              <Text style={styles.text}>Use this container for logging</Text>
              <Switch value={active} onValueChange={setActive} />
            </View>
            <Pressable
              disabled={busy}
              style={styles.button}
              onPress={() => void save()}
            >
              <Text style={styles.action}>
                {busy ? 'Saving…' : 'Save container details'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
export function InventoryEstimate({ item }: { item: TodayItem }) {
  const estimate = supplyEstimate(item);
  if (!item.inventory_containers?.length)
    return (
      <Text style={styles.detail}>
        Add a container to track your remaining supply.
      </Text>
    );
  return (
    <Text style={styles.detail}>
      {estimate.entries} entries in usable stock
      {estimate.until
        ? ` · estimated to run out on ${estimate.until}`
        : ' · no depletion date within the next year'}
      . Based on your entered schedule; estimates do not assess product safety.
    </Text>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: 40, gap: 16 },
  stack: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  text: { color: colors.text, fontSize: 14, fontWeight: '600' },
  detail: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  warning: { color: colors.warning, fontSize: 13, lineHeight: 20 },
  button: {
    minHeight: 44,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
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
  card: { padding: 12, borderRadius: radius.md, backgroundColor: colors.panel },
});
