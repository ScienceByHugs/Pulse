import { FormSheet } from './FormSheet';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  TextInput,
} from 'react-native';

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
import {
  containerDateKey,
  containerDateTimestamp,
} from '@/domain/containerDates';
import { colors, layout, radius, typography } from '@/theme';
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
          accessibilityRole="button"
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
          accessibilityLabel="Keep my home time zone"
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
    if (!source || busy) return;
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
    <FormSheet
      label={'Duplicate protocol'}
      visible={Boolean(source)}
      onClose={onClose}
      busy={busy}
    >
      <Text style={styles.title}>Review your new routine</Text>
      <Text style={styles.detail}>
        Copies substances and schedules. Your new protocol starts paused so you
        can review it before activating. Inventory and past logs stay with the
        original.
      </Text>
      <TextInput
        accessibilityLabel="Copied protocol name"
        value={name}
        onChangeText={setName}
        editable={!busy}
        maxLength={100}
        style={styles.input}
        placeholder={source ? `${source.name} copy` : 'Protocol name'}
        placeholderTextColor={colors.muted}
      />
      <ProtocolDatePicker
        label="New start date"
        disabled={busy}
        value={start}
        onChange={setStart}
      />
      <ProtocolDatePicker
        label="New end date (optional)"
        disabled={busy}
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
        accessibilityRole="button"
        disabled={busy}
        style={styles.button}
        onPress={() => void save()}
      >
        <Text style={styles.action}>
          {busy ? 'Creating…' : 'Create paused copy'}
        </Text>
      </Pressable>
    </FormSheet>
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
    setOpened(containerDateKey(container.opened_at));
    setExpires(containerDateKey(container.expires_at));
    setUseBy(containerDateKey(container.user_use_by_at));
    setLot(container.lot_number ?? '');
    setActive(container.is_active);
    setOpen(true);
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await updateInventoryDates(container.id, {
        opened_at: containerDateTimestamp(opened, 'start', container.opened_at),
        expires_at: containerDateTimestamp(
          expires,
          'end',
          container.expires_at,
        ),
        user_use_by_at: containerDateTimestamp(
          useBy,
          'end',
          container.user_use_by_at,
        ),
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
          ? `Opened ${containerDateKey(container.opened_at)} · `
          : ''}
        {container.expires_at
          ? `Expires ${containerDateKey(container.expires_at)}`
          : 'No expiry entered'}
      </Text>
      {container.user_use_by_at && (
        <Text style={styles.detail}>
          Recorded use-by {containerDateKey(container.user_use_by_at)}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={edit}
      >
        <Text style={styles.action}>Dates & container details</Text>
      </Pressable>
      <FormSheet
        label={'Container details'}
        visible={open}
        onClose={() => setOpen(false)}
        busy={busy}
      >
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.detail}>
          Enter dates from your own records or packaging. Pulse does not
          calculate product stability or recommend a use-by date.
        </Text>
        <Text style={styles.detail}>
          Dates use this device’s time zone. New expiry and recorded use-by
          dates include the whole selected day.
        </Text>
        <ProtocolDatePicker
          label="Opened date (optional)"
          value={opened}
          onChange={setOpened}
          disabled={busy}
        />
        <ProtocolDatePicker
          label="Expiry date (optional)"
          value={expires}
          onChange={setExpires}
          disabled={busy}
        />
        <ProtocolDatePicker
          label="Your recorded use-by date (optional)"
          value={useBy}
          onChange={setUseBy}
          disabled={busy}
        />
        <TextInput
          accessibilityLabel="Lot number, optional"
          value={lot}
          onChangeText={setLot}
          editable={!busy}
          maxLength={100}
          style={styles.input}
          placeholder="Lot number (optional)"
          placeholderTextColor={colors.muted}
        />
        <View style={styles.row}>
          <Text style={styles.text}>Use this container for logging</Text>
          <Switch
            accessibilityLabel="Use this container for logging"
            value={active}
            onValueChange={setActive}
            disabled={busy}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          style={styles.button}
          onPress={() => void save()}
        >
          <Text style={styles.action}>
            {busy ? 'Saving…' : 'Save container details'}
          </Text>
        </Pressable>
      </FormSheet>
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
  title: { ...typography.sectionTitle, color: colors.text },
  text: { ...typography.label, color: colors.text },
  detail: { ...typography.detail, color: colors.muted },
  warning: { ...typography.detail, color: colors.warning },
  button: {
    minHeight: 44,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  action: { ...typography.button, color: colors.accent },
  input: {
    ...typography.input,
    padding: 14,
    color: colors.text,
    backgroundColor: colors.panel2,
    borderRadius: radius.md,
  },
  card: { padding: 12, borderRadius: radius.md, backgroundColor: colors.panel },
});
