import { useWindowDimensions } from 'react-native';
import { InventoryHistoryButton } from '@/components/InventoryHistorySheet';
import { FormSheet } from '@/components/FormSheet';
import { RetryNotice } from '@/components/RetryNotice';
import { matchingSubstances } from '@/domain/substanceCatalog';
import { administrationLabel } from '@/domain/administration';
import {
  ScheduleExtras,
  DuplicateProtocolSheet,
  InventoryDetails,
  InventoryEstimate,
} from '@/components/ProtocolExtras';
import { occurrencesForDay } from '@/domain/occurrences';
import { rescheduleReminders } from '@/lib/reminders';
import { PageHeader } from '@/components/PageHeader';
import { OrbitalBackground } from '@/components/OrbitalBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, layout, radius, spacing, type } from '@/theme';
import { PulseMenu } from '@/components/PulseMenu';
import { SubstanceArtwork } from '@/components/SubstanceArtwork';
import {
  ProtocolDatePicker,
  ProtocolTimePicker,
  displayProtocolDate,
} from '@/components/ProtocolPickers';
import {
  addInventoryContainer,
  correctInventoryRemaining,
  createProtocol,
  createProtocolItem,
  pendingProtocolItemCreation,
  prepareProtocolItemCreation,
  listProtocolItems,
  listProtocols,
  setProtocolItemActive,
  setProtocolItemArchived,
  updateProtocolItemDetails,
  updateProtocolItemSchedule,
  updateProtocolDetails,
  updateProtocolStatus,
  type CreateItemInput,
  type TodayItem,
} from '@/services/pulse';
import { formatSchedule, localDateKey, scheduleTime } from '@/domain/schedule';

type Protocol = {
  id: string;
  name: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
};
const ROUTES = [
  'subcutaneous',
  'intramuscular',
  'oral',
  'topical',
  'other',
] as const;
const SCHEDULES = [
  'daily',
  'weekdays',
  'interval',
  'cycle',
  'as_needed',
] as const;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CATEGORIES = [
  'Peptide',
  'GLP-1',
  'Anabolic',
  'Medication',
  'Vitamin',
  'Supplement',
  'Other',
] as const;

export default function ProtocolScreen() {
  const { fontScale } = useWindowDimensions();
  const [duplicateSource, setDuplicateSource] = useState<Protocol | null>(null);
  const [additionalTimes, setAdditionalTimes] = useState<string[]>([]);
  const [timeZone, setTimeZone] = useState('local');
  const [editAdditionalTimes, setEditAdditionalTimes] = useState<string[]>([]);
  const [editTimeZone, setEditTimeZone] = useState('local');
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [items, setItems] = useState<TodayItem[]>([]);
  const [protocolName, setProtocolName] = useState('');
  const [editingProtocolId, setEditingProtocolId] = useState<string | null>(
    null,
  );
  const [editProtocolName, setEditProtocolName] = useState('');
  const [editStartsOn, setEditStartsOn] = useState('');
  const [editEndsOn, setEditEndsOn] = useState('');
  const [selectedProtocolId, setSelectedProtocolId] = useState<string | null>(
    null,
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editCategory, setEditCategory] = useState('Other');
  const [editDose, setEditDose] = useState('');
  const [editUnit, setEditUnit] = useState('mg');
  const [editRoute, setEditRoute] =
    useState<(typeof ROUTES)[number]>('subcutaneous');
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null,
  );
  const [editScheduleType, setEditScheduleType] = useState<
    'daily' | 'weekdays' | 'interval' | 'cycle' | 'as_needed'
  >('daily');
  const [editTime, setEditTime] = useState('');
  const [editDays, setEditDays] = useState<number[]>([]);
  const [editEveryDays, setEditEveryDays] = useState('2');
  const [editOnDays, setEditOnDays] = useState('5');
  const [editOffDays, setEditOffDays] = useState('2');
  const [editStartDate, setEditStartDate] = useState('');
  const [editOriginalSchedule, setEditOriginalSchedule] = useState<
    Record<string, unknown>
  >({});
  const [itemName, setItemName] = useState('');
  const [showSubstanceChoices, setShowSubstanceChoices] = useState(false);
  const [category, setCategory] = useState<string>('Peptide');
  const [showNewProtocol, setShowNewProtocol] = useState(false);
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState('mg');
  const [route, setRoute] = useState<(typeof ROUTES)[number] | null>(null);
  const [scheduleType, setScheduleType] =
    useState<(typeof SCHEDULES)[number]>('daily');
  const [time, setTime] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [everyDays, setEveryDays] = useState('2');
  const [onDays, setOnDays] = useState('5');
  const [offDays, setOffDays] = useState('2');
  const [inventory, setInventory] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [protocolLoading, setProtocolLoading] = useState(true);
  const [saveError, setSaveError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [reservoirEditorId, setReservoirEditorId] = useState<string | null>(
    null,
  );
  const [reservoirContainerId, setReservoirContainerId] = useState<
    string | null
  >(null);
  const [reservoirQuantity, setReservoirQuantity] = useState('');
  const [reservoirThreshold, setReservoirThreshold] = useState('0');
  const [reservoirReason, setReservoirReason] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [heldCreation, setHeldCreation] = useState<CreateItemInput | null>(
    null,
  );
  const [showMapDetails, setShowMapDetails] = useState(false);
  const [builderStep, setBuilderStep] = useState<1 | 2 | 3>(1);

  const activeProtocol = useMemo(
    () =>
      protocols.find(
        (p) => p.status !== 'archived' && p.id === selectedProtocolId,
      ) ?? protocols.find((p) => p.status === 'active'),
    [protocols, selectedProtocolId],
  );
  const activeItems = useMemo(
    () =>
      activeProtocol
        ? items.filter((item) => item.protocol_id === activeProtocol.id)
        : [],
    [activeProtocol, items],
  );
  const archivedItems = useMemo(
    () => activeItems.filter((item) => Boolean(item.archived_at)),
    [activeItems],
  );
  const visibleItems = useMemo(
    () => activeItems.filter((item) => !item.archived_at),
    [activeItems],
  );
  const protocolMap = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      const key = localDateKey(date);
      const withinWindow =
        (!activeProtocol?.starts_on || key >= activeProtocol.starts_on) &&
        (!activeProtocol?.ends_on || key <= activeProtocol.ends_on);
      const due = withinWindow
        ? visibleItems.flatMap((item) =>
            occurrencesForDay(
              {
                ...item,
                starts_on: activeProtocol?.starts_on,
                ends_on: activeProtocol?.ends_on,
              },
              key,
            ),
          )
        : [];
      return {
        key: localDateKey(date),
        label: formatter.format(date).slice(0, 3).toUpperCase(),
        day: date.getDate(),
        today: offset === 0,
        due,
        firstTime: due
          .map((item) => scheduleTime(item.schedule))
          .filter((value): value is string => Boolean(value))
          .sort()[0],
      };
    });
  }, [visibleItems, activeProtocol]);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [nextProtocols, nextItems] = await Promise.all([
        listProtocols(),
        listProtocolItems(),
      ]);
      setProtocols(nextProtocols as Protocol[]);
      setSelectedProtocolId((id) =>
        id && nextProtocols.some((p) => p.id === id && p.status !== 'archived')
          ? id
          : (nextProtocols.find((p) => p.status === 'active')?.id ?? null),
      );
      setItems(nextItems);
      const activeIds = new Set(
        nextProtocols.filter((p) => p.status === 'active').map((p) => p.id),
      );
      void rescheduleReminders(
        nextItems
          .filter(
            (i) =>
              i.active !== false &&
              !i.archived_at &&
              activeIds.has(i.protocol_id),
          )
          .map((i) => {
            const p = nextProtocols.find((p) => p.id === i.protocol_id);
            return { ...i, starts_on: p?.starts_on, ends_on: p?.ends_on };
          }),
      ).catch(() => undefined);
    } catch (error) {
      setLoadError(
        'Your protocols could not refresh. Check your connection and retry. Previously loaded information stays visible.',
      );
    } finally {
      setProtocolLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function addProtocol() {
    if (!protocolName.trim()) return;
    try {
      setBusy(true);
      const created = await createProtocol(protocolName);
      setProtocolName('');
      setShowNewProtocol(false);
      await load();
      setSelectedProtocolId(created.id);
    } catch (error) {
      Alert.alert(
        'Could not create protocol',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setBusy(false);
    }
  }

  async function setProtocolStatus(
    protocolId: string,
    status: 'active' | 'paused' | 'archived',
  ) {
    try {
      setBusy(true);
      await updateProtocolStatus(protocolId, status);
      if (status === 'active') setSelectedProtocolId(protocolId);
      await load();
    } catch (error) {
      Alert.alert(
        'Could not update protocol',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmProtocolArchive(protocol: Protocol) {
    if (busy) return;
    Alert.alert(
      'Archive protocol?',
      `Archive ${protocol.name}? It will stop appearing in active tracking. Its substance records and historical dose logs are preserved, and you can reactivate it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive protocol',
          style: 'destructive',
          onPress: () => void setProtocolStatus(protocol.id, 'archived'),
        },
      ],
    );
  }

  function startProtocolEdit(protocol: Protocol) {
    setEditingProtocolId(protocol.id);
    setEditProtocolName(protocol.name);
    setEditStartsOn(protocol.starts_on ?? '');
    setEditEndsOn(protocol.ends_on ?? '');
  }

  async function saveProtocolEdit() {
    if (!editingProtocolId || busy) return;
    try {
      setBusy(true);
      await updateProtocolDetails(
        editingProtocolId,
        editProtocolName,
        editStartsOn.trim() || null,
        editEndsOn.trim() || null,
      );
      setEditingProtocolId(null);
      await load();
    } catch (error) {
      Alert.alert(
        'Could not save protocol',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(item: TodayItem) {
    try {
      setBusy(true);
      await setProtocolItemActive(item.id, item.active === false);
      await load();
    } catch (error) {
      Alert.alert(
        'Could not update substance',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmArchive(item: TodayItem) {
    if (busy) return;
    Alert.alert(
      'Archive substance?',
      `Archive ${item.name}? It will leave active tracking and reminders. Existing dose history and inventory records are preserved. You can restore it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => void archiveItem(item.id, true),
        },
      ],
    );
  }

  async function archiveItem(itemId: string, archived: boolean) {
    if (busy) return;
    try {
      setBusy(true);
      await setProtocolItemArchived(itemId, archived);
      if (editingItemId === itemId) setEditingItemId(null);
      if (editingScheduleId === itemId) setEditingScheduleId(null);
      await load();
    } catch (error) {
      Alert.alert(
        archived
          ? 'Could not archive substance'
          : 'Could not restore substance',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveReservoir(item: TodayItem) {
    if (busy) return;
    const quantity = Number(reservoirQuantity);
    if (!reservoirQuantity.trim() || !Number.isFinite(quantity))
      return Alert.alert('Check quantity', 'Enter a valid numeric amount.');
    setSaveError(null);
    try {
      setBusy(true);
      if (reservoirContainerId) {
        await correctInventoryRemaining(
          reservoirContainerId,
          quantity,
          reservoirReason,
        );
      } else {
        const threshold = Number(reservoirThreshold);
        if (!reservoirThreshold.trim() || !Number.isFinite(threshold))
          throw new Error('Enter a valid low-stock threshold.');
        await addInventoryContainer(
          item.id,
          quantity,
          item.dose_unit,
          threshold,
        );
      }
      setReservoirEditorId(null);
      setReservoirContainerId(null);
      setReservoirQuantity('');
      setReservoirReason('');
      await load();
    } catch (error) {
      setSaveError({
        key: 'inventory',
        message:
          error instanceof Error
            ? error.message
            : 'Check your connection. Your changes are still in this form.',
      });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(item: TodayItem) {
    setSaveError(null);
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditCategory(item.category || 'Other');
    setEditDose(String(item.dose_amount));
    setEditUnit(item.dose_unit);
    setEditRoute(item.route as (typeof ROUTES)[number]);
  }

  async function saveItemEdit() {
    if (!editingItemId || busy) return;
    setSaveError(null);
    try {
      setBusy(true);
      await updateProtocolItemDetails(
        editingItemId,
        editItemName,
        editCategory,
        Number(editDose),
        editUnit,
        editRoute,
      );
      setEditingItemId(null);
      await load();
    } catch (error) {
      setSaveError({
        key: 'details',
        message:
          error instanceof Error
            ? error.message
            : 'Check your connection. Your changes are still in this form.',
      });
    } finally {
      setBusy(false);
    }
  }

  function beginScheduleEdit(item: TodayItem) {
    setSaveError(null);
    const schedule = item.schedule;
    const kind = String(schedule.type);
    setEditingScheduleId(item.id);
    setEditingItemId(null);
    setEditOriginalSchedule(schedule);
    setEditScheduleType(
      kind === 'weekdays' ||
        kind === 'interval' ||
        kind === 'cycle' ||
        kind === 'as_needed'
        ? kind
        : 'daily',
    );
    setEditAdditionalTimes(
      Array.isArray(schedule.times)
        ? (schedule.times as string[]).slice(1)
        : [],
    );
    setEditTimeZone(
      typeof schedule.timeZone === 'string' ? schedule.timeZone : 'local',
    );
    setEditTime(typeof schedule.time === 'string' ? schedule.time : '');
    setEditDays(
      Array.isArray(schedule.days)
        ? schedule.days.filter((d): d is number => typeof d === 'number')
        : [1, 2, 3, 4, 5],
    );
    setEditEveryDays(String(schedule.everyDays ?? 2));
    setEditOnDays(String(schedule.onDays ?? 5));
    setEditOffDays(String(schedule.offDays ?? 2));
    setEditStartDate(
      typeof schedule.startDate === 'string'
        ? schedule.startDate
        : localDateKey(),
    );
  }

  async function saveScheduleEdit() {
    if (!editingScheduleId || busy) return;
    const parsedPositive = (value: string) =>
      /^\d+$/.test(value) ? Number(value) : NaN;
    const next: Record<string, unknown> =
      editScheduleType === 'as_needed'
        ? { type: 'as_needed' }
        : {
            type: editScheduleType,
            ...(editTime.trim() ? { time: editTime.trim() } : {}),
          };
    if (editScheduleType !== 'as_needed') {
      next.times = [editTime.trim(), ...editAdditionalTimes].filter(Boolean);
      next.timeZone = editTimeZone;
    }
    if (editScheduleType === 'weekdays') next.days = editDays;
    if (editScheduleType === 'interval') {
      next.everyDays = parsedPositive(editEveryDays.trim());
      next.startDate = editStartDate.trim();
    }
    if (editScheduleType === 'cycle') {
      next.onDays = parsedPositive(editOnDays.trim());
      next.offDays = parsedPositive(editOffDays.trim());
      next.startDate = editStartDate.trim();
    }
    // Retain an existing short-term pause/override when editing the recurring pattern.
    if (editOriginalSchedule.temporary)
      next.temporary = editOriginalSchedule.temporary;
    setSaveError(null);
    try {
      setBusy(true);
      await updateProtocolItemSchedule(editingScheduleId, next);
      setEditingScheduleId(null);
      await load();
    } catch (error) {
      setSaveError({
        key: 'schedule',
        message:
          error instanceof Error
            ? error.message
            : 'Check your connection. Your changes are still in this form.',
      });
    } finally {
      setBusy(false);
    }
  }

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    );
  }

  function buildSchedule() {
    if (scheduleType === 'as_needed') return { type: 'as_needed' };
    const startDate = localDateKey();
    const extra = {
      times: [time, ...additionalTimes].filter(Boolean),
      timeZone,
    };
    if (scheduleType === 'daily') return { type: 'daily', time, ...extra };
    if (scheduleType === 'weekdays')
      return { type: 'weekdays', time, days, ...extra };
    if (scheduleType === 'interval')
      return {
        type: 'interval',
        time,
        ...extra,
        everyDays: Math.max(1, Number(everyDays) || 1),
        startDate,
      };
    return {
      type: 'cycle',
      time,
      ...extra,
      onDays: Math.max(1, Number(onDays) || 1),
      offDays: Math.max(0, Number(offDays) || 0),
      startDate,
    };
  }

  async function beginSubstance() {
    if (busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const original = await pendingProtocolItemCreation();
      setHeldCreation(original);
      setBuilderStep(1);
      setShowBuilder(!original);
    } catch (error) {
      Alert.alert(
        'Could not check the earlier save',
        error instanceof Error
          ? error.message
          : 'Check your connection and retry.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function finishItemCreation(input: CreateItemInput) {
    setItemName('');
    setShowSubstanceChoices(false);
    setDose('');
    setRoute(null);
    setInventory('');
    setShowBuilder(false);
    setBuilderStep(1);
    setHeldCreation(null);
    setSaveError(null);
    setSelectedProtocolId(input.protocolId);
    await load();
  }

  async function resumeItemCreation() {
    if (!heldCreation || busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      await createProtocolItem(heldCreation);
      await finishItemCreation(heldCreation);
    } catch (error) {
      setSaveError({
        key: 'creation',
        message:
          error instanceof Error
            ? error.message
            : 'Check your connection and retry the original save.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function addItem() {
    if (busy) return;
    const numericDose = Number(dose);
    const numericInventory = inventory ? Number(inventory) : undefined;
    if (
      inventory &&
      (!Number.isFinite(numericInventory) || Number(numericInventory) <= 0)
    )
      return Alert.alert(
        'Check container quantity',
        'Enter a positive total quantity, or leave it blank.',
      );
    if (!activeProtocol) return Alert.alert('Create a protocol first');
    if (
      !itemName.trim() ||
      !numericDose ||
      numericDose <= 0 ||
      !unit.trim() ||
      !route
    ) {
      return Alert.alert(
        'Check item details',
        'Name, amount, unit and administration type are required.',
      );
    }
    if (scheduleType === 'weekdays' && days.length === 0) {
      return Alert.alert('Choose at least one day');
    }

    let original: CreateItemInput;
    try {
      original = prepareProtocolItemCreation({
        protocolId: activeProtocol.id,
        name: itemName,
        category,
        route,
        doseAmount: numericDose,
        doseUnit: unit,
        schedule: buildSchedule(),
        inventoryAmount:
          numericInventory && numericInventory > 0
            ? numericInventory
            : undefined,
      });
    } catch (error) {
      setSaveError({
        key: 'substance',
        message:
          error instanceof Error ? error.message : 'Check your item details.',
      });
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      await createProtocolItem(original);
      await finishItemCreation(original);
    } catch (error) {
      // A failed durable creation may already have saved its parent. Preserve
      // its exact details, including any date anchor, rather than reopening an
      // editable form that would allocate a second parent ID.
      try {
        const pending = await pendingProtocolItemCreation();
        if (pending) {
          setHeldCreation(pending);
          setShowBuilder(false);
          setSaveError({
            key: 'creation',
            message:
              error instanceof Error
                ? error.message
                : 'The original save still needs confirmation.',
          });
        } else {
          setSaveError({
            key: 'substance',
            message:
              error instanceof Error
                ? error.message
                : 'Could not save. Your details are still in this form.',
          });
        }
      } catch {
        setHeldCreation(original);
        setShowBuilder(false);
        setSaveError({
          key: 'creation',
          message:
            error instanceof Error
              ? error.message
              : 'Could not confirm this save. Retry its original details.',
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <OrbitalBackground />
      <ScrollView
        contentContainerStyle={[
          styles.page,
          {
            paddingBottom: layout.pageBottom + Math.max(0, fontScale - 1) * 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <PulseMenu />
        {!!loadError && (
          <RetryNotice
            title="Could not refresh Protocol"
            message={loadError}
            onRetry={() => void load()}
          />
        )}
        <PageHeader
          title="Protocols"
          description="Manage your substances, schedules, and inventory."
        />

        {activeProtocol && (
          <Pressable
            accessibilityRole="button"
            style={styles.scheduleEditTrigger}
            onPress={() => setDuplicateSource(activeProtocol)}
          >
            <Text style={styles.scheduleEditTriggerText}>
              Duplicate this protocol
            </Text>
            <Text style={styles.scheduleEditSubtext}>
              Review a paused copy with new dates
            </Text>
          </Pressable>
        )}
        <DuplicateProtocolSheet
          key={duplicateSource?.id ?? 'none'}
          source={duplicateSource}
          items={items}
          onClose={() => setDuplicateSource(null)}
          onSaved={async (id) => {
            await load();
            if (id) setSelectedProtocolId(id);
          }}
        />
        <View style={styles.launchRow}>
          <Pressable
            accessibilityRole="button"
            style={styles.launchButton}
            onPress={() => setShowNewProtocol(true)}
          >
            <Text style={styles.launchText}>+ New protocol</Text>
          </Pressable>
          {activeProtocol ? (
            <Pressable
              accessibilityRole="button"
              style={styles.launchButton}
              onPress={() => void beginSubstance()}
            >
              <Text style={styles.launchText}>+ Add substance</Text>
            </Pressable>
          ) : null}
        </View>
        <FormSheet
          label={'New protocol'}
          visible={showNewProtocol}
          onClose={() => setShowNewProtocol(false)}
          busy={busy}
        >
          <View style={styles.builderCard}>
            <Text style={styles.builderTitle}>Name your new protocol</Text>
            <Text style={styles.smallLabel}>Protocol name</Text>
            <TextInput
              accessibilityLabel="Protocol name"
              maxLength={100}
              style={styles.input}
              placeholder="e.g. Daily regimen"
              placeholderTextColor={colors.muted}
              value={protocolName}
              onChangeText={setProtocolName}
            />
            <Pressable
              accessibilityRole="button"
              style={styles.primary}
              disabled={busy}
              onPress={() => void addProtocol()}
            >
              <Text style={styles.primaryText}>
                {busy ? 'Creating…' : 'Create protocol'}
              </Text>
            </Pressable>
          </View>
        </FormSheet>

        {heldCreation && (
          <FormSheet
            label="Resume substance save"
            busy={busy}
            onClose={() => setHeldCreation(null)}
          >
            <Text style={styles.builderTitle}>Confirm your earlier save</Text>
            <Text style={styles.cardDetail}>
              Part of this substance may already be saved. Resume the original
              details to finish safely, then edit the saved substance if needed.
              Closing this sheet keeps the recovery available in Add substance.
            </Text>
            <View style={styles.reviewBox}>
              <Text style={styles.reviewName}>{heldCreation.name}</Text>
              <Text style={styles.cardDetail}>
                {protocols.find((p) => p.id === heldCreation.protocolId)
                  ?.name ?? 'Original protocol'}
              </Text>
              <Text style={styles.cardDetail}>
                {heldCreation.doseAmount} {heldCreation.doseUnit} ·{' '}
                {administrationLabel(heldCreation.route)}
              </Text>
              <Text style={styles.scheduleText}>
                {formatSchedule(heldCreation.schedule)}
              </Text>
              {typeof heldCreation.schedule.startDate === 'string' && (
                <Text style={styles.cardDetail}>
                  Schedule anchor: {heldCreation.schedule.startDate}
                </Text>
              )}
              <Text style={styles.cardDetail}>
                {heldCreation.inventoryAmount
                  ? `Original container: ${heldCreation.inventoryAmount} ${heldCreation.doseUnit}`
                  : 'No initial container'}
              </Text>
            </View>
            {saveError?.key === 'creation' && (
              <RetryNotice
                title="Save still needs confirmation"
                message={saveError.message}
              />
            )}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              style={[styles.primary, busy && styles.disabled]}
              onPress={() => void resumeItemCreation()}
            >
              <Text style={styles.primaryText}>
                {busy ? 'Confirming…' : 'Resume original save'}
              </Text>
            </Pressable>
          </FormSheet>
        )}

        {activeProtocol && visibleItems.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Next: add your first substance</Text>
            <Text style={styles.cardDetail}>
              Choose a name or enter your own, then record your own
              administration type, amount and routine.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.primary}
              onPress={() => void beginSubstance()}
            >
              <Text style={styles.primaryText}>Add first substance</Text>
            </Pressable>
          </View>
        )}
        {protocolLoading && <ActivityIndicator color={colors.accent} />}
        {protocols.length === 0 ? (
          protocolLoading || loadError ? null : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Set up your first routine</Text>
              <Text style={styles.cardDetail}>
                1. Name your protocol. 2. Add a substance. 3. Review your own
                amount, method and schedule. Pulse does not choose these for
                you.
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.primary}
                onPress={() => setShowNewProtocol(true)}
              >
                <Text style={styles.primaryText}>New protocol</Text>
              </Pressable>
            </View>
          )
        ) : (
          <>
            {protocols.some((p) => p.status === 'active') ? (
              <View style={styles.protocolPicker}>
                <Text style={styles.smallLabel}>Choose a protocol</Text>
                <View style={styles.chips}>
                  {protocols
                    .filter((p) => p.status === 'active')
                    .map((p) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: activeProtocol?.id === p.id,
                        }}
                        key={p.id}
                        style={[
                          styles.chip,
                          activeProtocol?.id === p.id && styles.chipActive,
                        ]}
                        onPress={() => {
                          setSelectedProtocolId(p.id);
                          setShowBuilder(false);
                          setEditingItemId(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            activeProtocol?.id === p.id &&
                              styles.chipTextActive,
                          ]}
                        >
                          {p.name}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </View>
            ) : null}
            {activeProtocol ? (
              <View style={styles.card}>
                <Text style={styles.smallLabel}>Selected protocol</Text>
                <Text style={styles.cardTitle}>{activeProtocol.name}</Text>
                <Text style={styles.cardDetail}>{activeProtocol.status}</Text>
                <Text style={styles.cardDetail}>
                  {visibleItems.length} tracked items
                </Text>
                <View style={styles.protocolDateBand}>
                  <View style={styles.protocolDateColumn}>
                    <Text style={styles.smallLabel}>Start date</Text>
                    <Text style={styles.protocolDateText}>
                      {displayProtocolDate(activeProtocol.starts_on)}
                    </Text>
                  </View>
                  <View style={styles.protocolDateColumn}>
                    <Text style={styles.smallLabel}>End date</Text>
                    <Text style={styles.protocolDateText}>
                      {displayProtocolDate(activeProtocol.ends_on)}
                    </Text>
                  </View>
                </View>
                {editingProtocolId === activeProtocol.id ? (
                  <View style={styles.protocolEditPanel}>
                    <Text style={styles.smallLabel}>Protocol name</Text>
                    <TextInput
                      accessibilityLabel="Edit protocol name"
                      maxLength={100}
                      style={styles.input}
                      value={editProtocolName}
                      onChangeText={setEditProtocolName}
                      placeholderTextColor={colors.muted}
                    />
                    <Text style={styles.smallLabel}>
                      Tracking dates · optional
                    </Text>
                    <View style={styles.dateFields}>
                      <ProtocolDatePicker
                        label="Start date"
                        value={editStartsOn}
                        onChange={setEditStartsOn}
                        optional
                      />
                      <ProtocolDatePicker
                        label="End date"
                        value={editEndsOn}
                        onChange={setEditEndsOn}
                        optional
                      />
                    </View>
                    <Text style={styles.protocolEditHint}>
                      Dates restrict Today and the protocol map to that window.
                      Leave either blank for an open boundary.
                    </Text>
                    <View style={styles.protocolActions}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        style={styles.secondaryAction}
                        onPress={() => setEditingProtocolId(null)}
                      >
                        <Text style={styles.secondaryActionText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        style={styles.primaryInline}
                        onPress={() => void saveProtocolEdit()}
                      >
                        <Text style={styles.primaryText}>
                          {busy ? 'Saving…' : 'Save changes'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit protocol name and tracking dates"
                    style={styles.protocolEditTrigger}
                    onPress={() => startProtocolEdit(activeProtocol)}
                  >
                    <Text style={styles.protocolEditTriggerText}>
                      Edit protocol
                    </Text>
                  </Pressable>
                )}
                <View style={styles.protocolActions}>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.secondaryAction}
                    disabled={busy}
                    onPress={() =>
                      void setProtocolStatus(
                        activeProtocol.id,
                        activeProtocol.status === 'active'
                          ? 'paused'
                          : 'active',
                      )
                    }
                  >
                    <Text style={styles.secondaryActionText}>
                      {activeProtocol.status === 'active'
                        ? 'Pause'
                        : 'Activate after review'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.archiveAction}
                    disabled={busy}
                    onPress={() => confirmProtocolArchive(activeProtocol)}
                  >
                    <Text style={styles.archiveActionText}>Archive</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>No active protocol</Text>
                <Text style={styles.cardDetail}>
                  Activate a paused protocol below to return its scheduled items
                  to Today.
                </Text>
              </View>
            )}

            {protocols
              .filter((protocol) => protocol.status !== 'active')
              .map((protocol) => (
                <View style={styles.protocolRow} key={protocol.id}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{protocol.name}</Text>
                    <Text style={styles.cardDetail}>{protocol.status}</Text>
                  </View>
                  {protocol.status === 'paused' ||
                  protocol.status === 'archived' ? (
                    <Pressable
                      accessibilityRole="button"
                      style={styles.activateButton}
                      disabled={busy}
                      onPress={() =>
                        void setProtocolStatus(protocol.id, 'active')
                      }
                    >
                      <Text style={styles.activateText}>ACTIVATE</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}

            {activeProtocol && visibleItems.length ? (
              <View style={styles.mapCard}>
                <View style={styles.mapHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.smallLabel}>Schedule</Text>
                    <Text style={styles.mapTitle}>Your next 7 days</Text>
                    <Text style={styles.cardDetail}>
                      A live view of how your routine is distributed across the
                      week.
                    </Text>
                  </View>
                  <View style={styles.mapLegendPill}>
                    <Text style={styles.mapLegendText}>
                      {activeItems.length} ACTIVE
                    </Text>
                  </View>
                </View>

                <View style={styles.weekStrip}>
                  {protocolMap.map((day) => (
                    <View
                      key={day.key}
                      style={[
                        styles.dayColumn,
                        day.today && styles.dayColumnToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.mapDayLabel,
                          day.today && styles.mapDayLabelToday,
                        ]}
                      >
                        {day.label}
                      </Text>
                      <Text
                        style={[
                          styles.mapDayNumber,
                          day.today && styles.mapDayNumberToday,
                        ]}
                      >
                        {day.day}
                      </Text>
                      <View style={styles.loadTrack}>
                        <View
                          style={[
                            styles.loadFill,
                            {
                              height: Math.min(
                                30,
                                Math.max(4, day.due.length * 8),
                              ),
                            },
                            day.due.length === 0 && styles.loadFillEmpty,
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.mapCount,
                          day.due.length > 0 && styles.mapCountActive,
                        ]}
                      >
                        {day.due.length}
                      </Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showMapDetails
                      ? 'Hide schedule details'
                      : 'Show schedule details'
                  }
                  onPress={() => setShowMapDetails((value) => !value)}
                  style={styles.mapDetailsToggle}
                >
                  <Text style={styles.mapDetailsToggleText}>
                    {showMapDetails
                      ? 'Hide schedule details'
                      : 'View schedule details'}
                  </Text>
                </Pressable>
                {showMapDetails ? (
                  <View style={styles.mapScheduleList}>
                    {protocolMap
                      .filter((day) => day.due.length > 0)
                      .slice(0, 4)
                      .map((day, index) => (
                        <View
                          key={day.key}
                          style={[
                            styles.mapScheduleRow,
                            index > 0 && styles.mapScheduleDivider,
                          ]}
                        >
                          <View style={styles.mapScheduleDay}>
                            <Text style={styles.mapScheduleDayText}>
                              {day.label}
                            </Text>
                            <Text style={styles.mapScheduleDate}>
                              {day.day}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={styles.mapScheduleItems}
                              numberOfLines={1}
                            >
                              {day.due.map((item) => item.name).join(' · ')}
                            </Text>
                            <Text style={styles.mapScheduleMeta}>
                              {day.due.length} scheduled
                              {day.firstTime
                                ? ` · first at ${day.firstTime}`
                                : ''}
                            </Text>
                          </View>
                        </View>
                      ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {activeProtocol && !showBuilder ? (
              <Pressable
                accessibilityRole="button"
                style={styles.addItemLaunch}
                onPress={() => void beginSubstance()}
              >
                <View style={styles.addIcon}>
                  <Text style={styles.addIconText}>＋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Add to your protocol</Text>
                  <Text style={styles.cardDetail}>
                    Add a substance and its schedule.
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ) : null}

            {activeProtocol && showBuilder ? (
              <FormSheet
                label={`Add substance · ${builderStep} of 3`}
                visible={true}
                onClose={() => {
                  setShowBuilder(false);
                  setBuilderStep(1);
                }}
                busy={busy}
                contentKey={builderStep}
              >
                <View style={styles.builderCard}>
                  <Text style={styles.builderTitle}>
                    {builderStep === 1
                      ? 'What are you tracking?'
                      : builderStep === 2
                        ? 'When do you take it?'
                        : 'Inventory & review'}
                  </Text>
                  <View style={styles.progress}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width:
                            builderStep === 1
                              ? '33%'
                              : builderStep === 2
                                ? '66%'
                                : '100%',
                        },
                      ]}
                    />
                  </View>

                  {builderStep === 1 ? (
                    <>
                      <Text style={styles.smallLabel}>Substance name</Text>
                      <TextInput
                        accessibilityLabel="Substance name"
                        style={styles.input}
                        placeholder="Item name"
                        placeholderTextColor={colors.muted}
                        value={itemName}
                        onChangeText={(value) => {
                          setItemName(value);
                          setShowSubstanceChoices(true);
                        }}
                      />
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          setShowSubstanceChoices((value) => !value)
                        }
                        style={styles.backButton}
                      >
                        <Text style={styles.backText}>
                          {showSubstanceChoices
                            ? 'Close substance list'
                            : 'Choose from substance list ▾'}
                        </Text>
                      </Pressable>
                      {showSubstanceChoices && (
                        <View style={styles.editCard}>
                          <Text style={styles.scheduleHint}>
                            Names for identifying what you already track. No
                            amounts, routes or routines are recommended.
                          </Text>
                          {matchingSubstances(itemName).map((entry) => (
                            <Pressable
                              key={entry.name}
                              accessibilityRole="button"
                              style={styles.backButton}
                              onPress={() => {
                                setItemName(entry.name);
                                setCategory(entry.category);
                                setShowSubstanceChoices(false);
                              }}
                            >
                              <Text style={styles.backText}>{entry.name}</Text>
                            </Pressable>
                          ))}
                          <Pressable
                            accessibilityRole="button"
                            style={styles.backButton}
                            onPress={() => setShowSubstanceChoices(false)}
                          >
                            <Text style={styles.backText}>
                              {itemName.trim()
                                ? `Use custom name: ${itemName.trim()}`
                                : 'Type my own substance name above'}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                      <Text style={styles.smallLabel}>
                        Amount per logged entry
                      </Text>
                      <Text style={styles.scheduleHint}>
                        Separate from the total amount in your vial. Enter your
                        own amount and administration type.
                      </Text>
                      <View style={styles.twoCol}>
                        <TextInput
                          style={[styles.input, styles.flex]}
                          placeholder="Amount per entry"
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          value={dose}
                          onChangeText={setDose}
                        />
                        <TextInput
                          style={[styles.input, styles.flex]}
                          placeholder="Unit"
                          placeholderTextColor={colors.muted}
                          value={unit}
                          onChangeText={setUnit}
                          autoCapitalize="none"
                        />
                      </View>
                      <Text style={styles.smallLabel}>Category</Text>
                      <View style={styles.chips}>
                        {CATEGORIES.map((value) => (
                          <Pressable
                            accessibilityRole="button"
                            key={value}
                            onPress={() => setCategory(value)}
                            style={[
                              styles.chip,
                              category === value && styles.chipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                category === value && styles.chipTextActive,
                              ]}
                            >
                              {value}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={styles.smallLabel}>Administration type</Text>
                      <Text style={styles.scheduleHint}>
                        Saved for this substance and used for future logs.
                        Choose the method in your clinician’s instructions.
                      </Text>
                      <View style={styles.chips}>
                        {ROUTES.map((value) => (
                          <Pressable
                            key={administrationLabel(value)}
                            accessibilityRole="button"
                            accessibilityLabel={administrationLabel(value)}
                            accessibilityState={{ selected: route === value }}
                            onPress={() => setRoute(value)}
                            style={[
                              styles.chip,
                              route === value && styles.chipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                route === value && styles.chipTextActive,
                              ]}
                            >
                              {administrationLabel(value)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        style={styles.primary}
                        onPress={() => {
                          if (
                            !itemName.trim() ||
                            !Number(dose) ||
                            Number(dose) <= 0 ||
                            !unit.trim() ||
                            !route
                          )
                            return Alert.alert(
                              'Add the basics first',
                              'Enter a name, amount, unit and administration type to continue.',
                            );
                          setBuilderStep(2);
                        }}
                      >
                        <Text style={styles.primaryText}>Continue</Text>
                      </Pressable>
                    </>
                  ) : null}

                  {builderStep === 2 ? (
                    <>
                      <View style={styles.builderSummary}>
                        <Text style={styles.builderSummaryName}>
                          {itemName}
                        </Text>
                        <Text style={styles.cardDetail}>
                          {dose} {unit} · {administrationLabel(route)}
                        </Text>
                      </View>

                      <Text style={styles.smallLabel}>Schedule</Text>
                      <View style={styles.chips}>
                        {SCHEDULES.map((value) => (
                          <Pressable
                            accessibilityRole="button"
                            key={value}
                            onPress={() => setScheduleType(value)}
                            style={[
                              styles.chip,
                              scheduleType === value && styles.chipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                scheduleType === value && styles.chipTextActive,
                              ]}
                            >
                              {value === 'as_needed' ? 'As needed' : value}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      {scheduleType !== 'as_needed' ? (
                        <>
                          {' '}
                          <ProtocolTimePicker
                            label="Scheduled time"
                            value={time}
                            onChange={setTime}
                          />
                          <ScheduleExtras
                            times={additionalTimes}
                            onTimes={setAdditionalTimes}
                            zone={timeZone}
                            onZone={setTimeZone}
                          />
                        </>
                      ) : (
                        <Text style={styles.scheduleHint}>
                          No automatic due time or reminder. Use Today’s
                          as-needed section to record actual activity.
                        </Text>
                      )}
                      {scheduleType === 'weekdays' ? (
                        <View style={styles.dayRow}>
                          {DAY_LABELS.map((label, day) => (
                            <Pressable
                              accessibilityRole="button"
                              key={`${label}-${day}`}
                              style={[
                                styles.day,
                                days.includes(day) && styles.dayActive,
                              ]}
                              onPress={() => toggleDay(day)}
                            >
                              <Text
                                style={[
                                  styles.dayText,
                                  days.includes(day) && styles.chipTextActive,
                                ]}
                              >
                                {label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}

                      {scheduleType === 'interval' ? (
                        <TextInput
                          style={styles.input}
                          placeholder="Every X days"
                          placeholderTextColor={colors.muted}
                          keyboardType="number-pad"
                          value={everyDays}
                          onChangeText={setEveryDays}
                        />
                      ) : null}

                      {scheduleType === 'cycle' ? (
                        <View style={styles.twoCol}>
                          <TextInput
                            style={[styles.input, styles.flex]}
                            placeholder="Days on"
                            placeholderTextColor={colors.muted}
                            keyboardType="number-pad"
                            value={onDays}
                            onChangeText={setOnDays}
                          />
                          <TextInput
                            style={[styles.input, styles.flex]}
                            placeholder="Days off"
                            placeholderTextColor={colors.muted}
                            keyboardType="number-pad"
                            value={offDays}
                            onChangeText={setOffDays}
                          />
                        </View>
                      ) : null}

                      <View style={styles.builderNav}>
                        <Pressable
                          accessibilityRole="button"
                          style={styles.backButton}
                          onPress={() => setBuilderStep(1)}
                        >
                          <Text style={styles.backText}>Back</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          style={[styles.primary, styles.flex]}
                          onPress={() => {
                            if (
                              scheduleType === 'weekdays' &&
                              days.length === 0
                            )
                              return Alert.alert('Choose at least one day');
                            setBuilderStep(3);
                          }}
                        >
                          <Text style={styles.primaryText}>Continue</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : null}

                  {builderStep === 3 ? (
                    <>
                      <View style={styles.reviewBox}>
                        <Text style={styles.reviewName}>{itemName}</Text>
                        <Text style={styles.cardDetail}>
                          {dose} {unit} · {administrationLabel(route)}
                        </Text>
                        <Text style={styles.scheduleText}>
                          {formatSchedule(buildSchedule())}
                        </Text>
                      </View>
                      <Text style={styles.smallLabel}>
                        Total in one vial/container · optional
                      </Text>
                      <TextInput
                        style={styles.input}
                        accessibilityLabel="Total quantity in one container"
                        editable={!busy}
                        placeholder={`Total container quantity in ${unit || 'same unit'}`}
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                        value={inventory}
                        onChangeText={setInventory}
                      />
                      {saveError?.key === 'substance' && (
                        <RetryNotice
                          title="Check this substance"
                          message={saveError.message}
                        />
                      )}
                      <Text style={styles.scheduleHint}>
                        This creates one container. For example, a 20 mg vial
                        belongs here; it does not set the amount you log.
                        Artwork uses this original container total, not
                        remaining stock.
                      </Text>
                      <View style={styles.builderNav}>
                        <Pressable
                          accessibilityRole="button"
                          style={styles.backButton}
                          disabled={busy}
                          onPress={() => setBuilderStep(2)}
                        >
                          <Text style={styles.backText}>Back</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          style={[
                            styles.primary,
                            styles.flex,
                            busy && styles.disabled,
                          ]}
                          disabled={busy}
                          onPress={() => void addItem()}
                        >
                          <Text style={styles.primaryText}>
                            {busy ? 'Adding…' : 'Add substance'}
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : null}
                </View>
              </FormSheet>
            ) : null}

            {activeProtocol ? (
              <View style={styles.libraryHeading}>
                <View>
                  <Text style={styles.libraryTitle}>Your substances</Text>
                  <Text style={styles.librarySubtitle}>
                    {
                      visibleItems.filter((item) => item.active !== false)
                        .length
                    }{' '}
                    tracking ·{' '}
                    {
                      visibleItems.filter((item) => item.active === false)
                        .length
                    }{' '}
                    paused
                  </Text>
                </View>
              </View>
            ) : null}
            {activeProtocol
              ? visibleItems.map((item) => {
                  const inventoryItem = item.inventory_containers?.find(
                    (container) => container.is_active,
                  );
                  const isLow = inventoryItem
                    ? inventoryItem.remaining_amount <=
                      inventoryItem.low_threshold
                    : false;
                  const fraction =
                    inventoryItem && inventoryItem.total_amount > 0
                      ? Math.max(
                          0,
                          Math.min(
                            100,
                            (inventoryItem.remaining_amount /
                              inventoryItem.total_amount) *
                              100,
                          ),
                        )
                      : 0;
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.signatureCard,
                        item.active === false && styles.signatureCardPaused,
                      ]}
                    >
                      <View style={styles.signatureAccent} />
                      <View style={styles.signatureTop}>
                        <SubstanceArtwork
                          category={item.category}
                          route={item.route}
                          name={item.name}
                          itemId={item.id}
                          vialQuantity={
                            inventoryItem
                              ? `${inventoryItem.total_amount} ${inventoryItem.unit}`
                              : undefined
                          }
                          inactive={item.active === false}
                        />
                        <View style={styles.signatureHeaderText}>
                          <Text style={styles.signatureCategory}>
                            {item.category || 'Other'} ·{' '}
                            {item.active === false ? 'Paused' : 'Active'}
                          </Text>
                          <Text style={styles.signatureName}>{item.name}</Text>
                          <Text style={styles.signatureAmount}>
                            {item.dose_amount} {item.dose_unit} ·{' '}
                            {administrationLabel(item.route)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.signatureDivider} />
                      <View style={styles.signatureMeta}>
                        <View style={styles.signatureMetaColumn}>
                          <Text style={styles.signatureMetaLabel}>
                            Schedule
                          </Text>
                          <Text style={styles.signatureMetaValue}>
                            {formatSchedule(item.schedule)}
                          </Text>
                        </View>
                        <View style={styles.signatureStockColumn}>
                          <Text style={styles.signatureMetaLabel}>
                            Inventory
                          </Text>
                          <Text
                            style={[
                              styles.signatureStock,
                              isLow && styles.signatureLow,
                            ]}
                          >
                            {inventoryItem
                              ? `${inventoryItem.remaining_amount} ${inventoryItem.unit}`
                              : 'Not tracked'}
                          </Text>
                        </View>
                      </View>
                      {inventoryItem ? (
                        <View style={styles.signatureReservoir}>
                          <View style={styles.signatureReservoirTrack}>
                            <View
                              style={[
                                styles.signatureReservoirFill,
                                {
                                  width: `${fraction}%` as `${number}%`,
                                  backgroundColor: isLow
                                    ? colors.warning
                                    : colors.accent,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.signatureReservoirFoot}>
                            {isLow ? 'Low stock · ' : ''}
                            {Math.round(fraction)}% of starting quantity
                          </Text>
                        </View>
                      ) : null}
                      <View style={{ gap: 9 }}>
                        <InventoryEstimate item={item} />
                        <InventoryHistoryButton item={item} />
                        {(item.inventory_containers ?? []).map(
                          (container, index) => (
                            <View key={container.id} style={styles.protocolRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.itemTitle}>
                                  CONTAINER {index + 1}
                                </Text>
                                <Text style={styles.cardDetail}>
                                  {container.remaining_amount} /{' '}
                                  {container.total_amount} {container.unit} ·
                                  Low at {container.low_threshold}{' '}
                                  {container.unit}
                                </Text>
                              </View>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Correct container ${index + 1} balance`}
                                disabled={busy}
                                style={styles.activateButton}
                                onPress={() => {
                                  setSaveError(null);
                                  setReservoirEditorId(item.id);
                                  setReservoirContainerId(container.id);
                                  setReservoirQuantity(
                                    String(container.remaining_amount),
                                  );
                                  setReservoirReason('');
                                }}
                              >
                                <Text style={styles.activateText}>CORRECT</Text>
                              </Pressable>
                            </View>
                          ),
                        )}
                        {(item.inventory_containers ?? []).map((container) => (
                          <InventoryDetails
                            key={container.id}
                            item={item}
                            container={container}
                            onSaved={load}
                          />
                        ))}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Add container for ${item.name}`}
                          disabled={busy}
                          style={styles.scheduleEditTrigger}
                          onPress={() => {
                            setSaveError(null);
                            setReservoirEditorId(item.id);
                            setReservoirContainerId(null);
                            setReservoirQuantity('');
                            setReservoirThreshold('0');
                          }}
                        >
                          <Text style={styles.scheduleEditTriggerText}>
                            ＋ ADD CONTAINER
                          </Text>
                        </Pressable>
                        {reservoirEditorId === item.id ? (
                          <FormSheet
                            label={`Inventory · ${item.name}`}
                            busy={busy}
                            onClose={() => setReservoirEditorId(null)}
                          >
                            {saveError?.key === 'inventory' && (
                              <RetryNotice
                                title="Could not save inventory"
                                message={saveError.message}
                                busy={busy}
                                onRetry={() => void saveReservoir(item)}
                              />
                            )}
                            <Text style={styles.smallLabel}>
                              {reservoirContainerId
                                ? 'CORRECT REMAINING QUANTITY'
                                : 'INVENTORY · NEW CONTAINER'}
                            </Text>
                            <Text style={styles.scheduleHint}>
                              {reservoirContainerId
                                ? 'Correct the stock you actually have left. This does not change your amount per entry.'
                                : 'Enter the total quantity in this container, separate from your amount per entry.'}
                            </Text>
                            <TextInput
                              accessibilityLabel="Container quantity"
                              keyboardType="decimal-pad"
                              style={styles.input}
                              value={reservoirQuantity}
                              onChangeText={setReservoirQuantity}
                              placeholder="Quantity"
                              placeholderTextColor={colors.muted}
                            />
                            <Text style={styles.cardDetail}>
                              Unit: {item.dose_unit}
                            </Text>
                            {reservoirContainerId ? (
                              <>
                                <Text style={styles.smallLabel}>
                                  REASON FOR CORRECTION · REQUIRED
                                </Text>
                                <TextInput
                                  accessibilityLabel="Reason for inventory correction"
                                  style={styles.input}
                                  value={reservoirReason}
                                  onChangeText={setReservoirReason}
                                  placeholder="e.g. manual recount"
                                  placeholderTextColor={colors.muted}
                                />
                              </>
                            ) : (
                              <>
                                <Text style={styles.smallLabel}>
                                  LOW STOCK WHEN REMAINING AT OR BELOW
                                </Text>
                                <TextInput
                                  accessibilityLabel="Low stock quantity threshold"
                                  keyboardType="decimal-pad"
                                  style={styles.input}
                                  value={reservoirThreshold}
                                  onChangeText={setReservoirThreshold}
                                />
                              </>
                            )}
                            <View style={styles.protocolActions}>
                              <Pressable
                                accessibilityRole="button"
                                disabled={busy}
                                style={styles.secondaryAction}
                                onPress={() => setReservoirEditorId(null)}
                              >
                                <Text style={styles.secondaryActionText}>
                                  Cancel
                                </Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                disabled={busy}
                                style={styles.primaryInline}
                                onPress={() => void saveReservoir(item)}
                              >
                                <Text style={styles.primaryText}>Save</Text>
                              </Pressable>
                            </View>
                          </FormSheet>
                        ) : null}
                      </View>
                      <View style={styles.signatureActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${item.name}`}
                          style={styles.signatureEditButton}
                          disabled={busy}
                          onPress={() => {
                            setEditingScheduleId(null);
                            startEdit(item);
                          }}
                        >
                          <Text style={styles.signatureEditText}>
                            EDIT DETAILS ↗
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            item.active === false
                              ? `Resume ${item.name}`
                              : `Pause ${item.name}`
                          }
                          style={styles.signaturePauseButton}
                          disabled={busy}
                          onPress={() => void toggleItem(item)}
                        >
                          <Text style={styles.signaturePauseText}>
                            {item.active === false ? 'RESUME' : 'Pause'}
                          </Text>
                        </Pressable>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Archive ${item.name}`}
                        disabled={busy}
                        style={styles.archiveAction}
                        onPress={() => confirmArchive(item)}
                      >
                        <Text style={styles.archiveActionText}>
                          ARCHIVE SUBSTANCE · PRESERVE HISTORY
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit schedule for ${item.name}`}
                        style={styles.scheduleEditTrigger}
                        disabled={busy}
                        onPress={() => beginScheduleEdit(item)}
                      >
                        <Text style={styles.scheduleEditTriggerText}>
                          EDIT SCHEDULE ↗
                        </Text>
                        <Text style={styles.scheduleEditSubtext}>
                          Adjust the tracking pattern without removing history
                        </Text>
                      </Pressable>
                      {editingScheduleId === item.id ? (
                        <FormSheet
                          label={`Schedule · ${item.name}`}
                          busy={busy}
                          onClose={() => setEditingScheduleId(null)}
                        >
                          {saveError?.key === 'schedule' && (
                            <RetryNotice
                              title="Could not save schedule"
                              message={saveError.message}
                              busy={busy}
                              onRetry={() => void saveScheduleEdit()}
                            />
                          )}
                          <Text style={styles.smallLabel}>
                            TRACKING PATTERN
                          </Text>
                          <View style={styles.chips}>
                            {(
                              [
                                'daily',
                                'weekdays',
                                'interval',
                                'cycle',
                                'as_needed',
                              ] as const
                            ).map((kind) => (
                              <Pressable
                                key={kind}
                                accessibilityRole="button"
                                accessibilityState={{
                                  selected: editScheduleType === kind,
                                }}
                                onPress={() => setEditScheduleType(kind)}
                                style={[
                                  styles.chip,
                                  editScheduleType === kind &&
                                    styles.chipActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    editScheduleType === kind &&
                                      styles.chipTextActive,
                                  ]}
                                >
                                  {kind === 'as_needed' ? 'As needed' : kind}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                          {editScheduleType !== 'as_needed' ? (
                            <>
                              <Text style={styles.smallLabel}>
                                SCHEDULED TIME · 12-HOUR OR 24-HOUR
                              </Text>
                              <ProtocolTimePicker
                                label="Scheduled time"
                                value={editTime}
                                onChange={setEditTime}
                              />
                              <ScheduleExtras
                                times={editAdditionalTimes}
                                onTimes={setEditAdditionalTimes}
                                zone={editTimeZone}
                                onZone={setEditTimeZone}
                              />
                            </>
                          ) : null}
                          {editScheduleType === 'weekdays' ? (
                            <>
                              <Text style={styles.smallLabel}>
                                DAYS OF THE WEEK
                              </Text>
                              <View style={styles.dayRow}>
                                {DAY_LABELS.map((label, day) => (
                                  <Pressable
                                    key={day}
                                    accessibilityRole="button"
                                    accessibilityState={{
                                      selected: editDays.includes(day),
                                    }}
                                    style={[
                                      styles.day,
                                      editDays.includes(day) &&
                                        styles.dayActive,
                                    ]}
                                    onPress={() =>
                                      setEditDays((current) =>
                                        current.includes(day)
                                          ? current.filter((d) => d !== day)
                                          : [...current, day].sort(),
                                      )
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.dayText,
                                        editDays.includes(day) &&
                                          styles.chipTextActive,
                                      ]}
                                    >
                                      {label}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            </>
                          ) : null}
                          {editScheduleType === 'interval' ||
                          editScheduleType === 'cycle' ? (
                            <>
                              <Text style={styles.smallLabel}>ANCHOR DATE</Text>
                              <ProtocolDatePicker
                                label="Schedule anchor date"
                                value={editStartDate}
                                onChange={setEditStartDate}
                              />
                              <Text style={styles.scheduleHint}>
                                Changing the anchor date will change where
                                interval or cycle days fall.
                              </Text>
                            </>
                          ) : null}
                          {editScheduleType === 'interval' ? (
                            <>
                              <Text style={styles.smallLabel}>
                                REPEAT EVERY (DAYS)
                              </Text>
                              <TextInput
                                style={styles.input}
                                accessibilityLabel="Repeat interval days"
                                keyboardType="number-pad"
                                value={editEveryDays}
                                onChangeText={setEditEveryDays}
                              />
                            </>
                          ) : null}
                          {editScheduleType === 'cycle' ? (
                            <>
                              <Text style={styles.smallLabel}>
                                CYCLE PATTERN
                              </Text>
                              <View style={styles.twoCol}>
                                <TextInput
                                  style={[styles.input, styles.flex]}
                                  accessibilityLabel="Cycle on days"
                                  placeholder="Days on"
                                  placeholderTextColor={colors.muted}
                                  keyboardType="number-pad"
                                  value={editOnDays}
                                  onChangeText={setEditOnDays}
                                />
                                <TextInput
                                  style={[styles.input, styles.flex]}
                                  accessibilityLabel="Cycle off days"
                                  placeholder="Days off"
                                  placeholderTextColor={colors.muted}
                                  keyboardType="number-pad"
                                  value={editOffDays}
                                  onChangeText={setEditOffDays}
                                />
                              </View>
                            </>
                          ) : null}
                          <Text style={styles.scheduleHint}>
                            New settings apply to future tracking. Your existing
                            recorded entries are preserved.
                          </Text>
                          <View style={styles.builderNav}>
                            <Pressable
                              accessibilityRole="button"
                              style={styles.backButton}
                              disabled={busy}
                              onPress={() => setEditingScheduleId(null)}
                            >
                              <Text style={styles.backText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              style={[styles.primary, styles.flex]}
                              disabled={busy}
                              onPress={() => void saveScheduleEdit()}
                            >
                              <Text style={styles.primaryText}>
                                {busy ? 'Saving…' : 'SAVE SCHEDULE'}
                              </Text>
                            </Pressable>
                          </View>
                        </FormSheet>
                      ) : null}
                      {editingItemId === item.id ? (
                        <FormSheet
                          label={`Substance · ${item.name}`}
                          busy={busy}
                          onClose={() => setEditingItemId(null)}
                        >
                          {saveError?.key === 'details' && (
                            <RetryNotice
                              title="Could not save details"
                              message={saveError.message}
                              busy={busy}
                              onRetry={() => void saveItemEdit()}
                            />
                          )}
                          <Text style={styles.smallLabel}>
                            EDIT SUBSTANCE · {item.name}
                          </Text>
                          <TextInput
                            accessibilityLabel="Substance name"
                            style={styles.input}
                            maxLength={100}
                            value={editItemName}
                            onChangeText={setEditItemName}
                          />
                          <Text style={styles.smallLabel}>Category</Text>
                          <View style={styles.chips}>
                            {CATEGORIES.map((cat) => (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityState={{
                                  selected: editCategory === cat,
                                }}
                                key={cat}
                                onPress={() => setEditCategory(cat)}
                                style={[
                                  styles.chip,
                                  editCategory === cat && styles.chipActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    editCategory === cat &&
                                      styles.chipTextActive,
                                  ]}
                                >
                                  {cat}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                          <Text style={styles.smallLabel}>
                            TRACKED AMOUNT AND UNIT
                          </Text>
                          <Text style={styles.scheduleHint}>
                            Amount per entry, separate from the total in your
                            container.
                          </Text>
                          <View style={styles.twoCol}>
                            <View style={styles.flex}>
                              <Text style={styles.smallLabel}>Amount</Text>
                              <TextInput
                                accessibilityLabel="Dose amount"
                                style={[styles.input, styles.flex]}
                                keyboardType="decimal-pad"
                                value={editDose}
                                onChangeText={setEditDose}
                              />
                            </View>
                            <View style={styles.flex}>
                              <Text style={styles.smallLabel}>Unit</Text>
                              <TextInput
                                accessibilityLabel="Dose unit"
                                style={[styles.input, styles.flex]}
                                value={editUnit}
                                onChangeText={setEditUnit}
                              />
                            </View>
                          </View>
                          <Text style={styles.smallLabel}>
                            Administration type
                          </Text>
                          <Text style={styles.scheduleHint}>
                            Saved for this substance and used for future logs.
                            Choose the method in your clinician’s instructions.
                          </Text>
                          <View style={styles.chips}>
                            {ROUTES.map((kind) => (
                              <Pressable
                                key={kind}
                                accessibilityRole="button"
                                accessibilityLabel={administrationLabel(kind)}
                                accessibilityState={{
                                  selected: editRoute === kind,
                                }}
                                style={[
                                  styles.chip,
                                  editRoute === kind && styles.chipActive,
                                ]}
                                onPress={() => setEditRoute(kind)}
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    editRoute === kind && styles.chipTextActive,
                                  ]}
                                >
                                  {administrationLabel(kind)}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                          <Text style={styles.scheduleHint}>
                            Changing units will not convert previously recorded
                            inventory or dose history.
                          </Text>
                          <View style={styles.builderNav}>
                            <Pressable
                              accessibilityRole="button"
                              style={styles.backButton}
                              disabled={busy}
                              onPress={() => setEditingItemId(null)}
                            >
                              <Text style={styles.backText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              style={[styles.primary, styles.flex]}
                              disabled={busy}
                              onPress={() => void saveItemEdit()}
                            >
                              <Text style={styles.primaryText}>
                                {busy ? 'Saving…' : 'SAVE DETAILS'}
                              </Text>
                            </Pressable>
                          </View>
                        </FormSheet>
                      ) : null}
                    </View>
                  );
                })
              : null}
          </>
        )}
        {activeProtocol && archivedItems.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.smallLabel}>
              ARCHIVED SUBSTANCES · {archivedItems.length}
            </Text>
            <Text style={styles.cardDetail}>
              Hidden from active tracking. History is retained. Restore a
              substance to make it available as paused.
            </Text>
            {archivedItems.map((item) => (
              <View style={styles.protocolRow} key={item.id}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.cardDetail}>
                    {item.category || 'Other'} · Archived
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Restore ${item.name}`}
                  disabled={busy}
                  style={styles.activateButton}
                  onPress={() => void archiveItem(item.id, false)}
                >
                  <Text style={styles.activateText}>Restore</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalPage: { padding: layout.pageInset, paddingBottom: 32, gap: 16 },
  dateFields: { gap: 8 },
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: layout.pageBottom },
  launchRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  launchButton: {
    flex: 1,
    minHeight: 48,
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  launchText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: layout.cardInset,
    borderWidth: 0,
    borderColor: 'transparent',
    gap: 12,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  cardDetail: { color: colors.muted, marginTop: 4, lineHeight: 20 },
  scheduleText: {
    color: colors.accent,
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 15,
  },
  twoCol: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 2,
  },
  primaryText: { color: '#03111f', fontWeight: '700', fontSize: 15 },
  smallLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: colors.panel2,
  },
  chipActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  chipText: { color: colors.muted, fontSize: 12, textTransform: 'capitalize' },
  chipTextActive: { color: colors.accent, fontWeight: '800' },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel2,
  },
  dayActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  dayText: { color: colors.muted, fontWeight: '800' },
  protocolPicker: {
    backgroundColor: 'transparent',
    padding: layout.cardInset,
    borderRadius: 0,
    borderColor: 'transparent',
    borderWidth: 0,
    marginBottom: spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editCard: {
    backgroundColor: colors.panel2,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderColor: colors.accentBorder,
    borderWidth: 1,
    marginTop: 6,
    gap: 12,
  },
  libraryHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  libraryTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  librarySubtitle: { color: colors.muted, fontSize: 12, marginTop: 4 },
  scheduleEditTrigger: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.md,
    minHeight: 55,
    paddingVertical: 11,
    paddingHorizontal: 13,
    justifyContent: 'center',
    gap: 4,
  },
  scheduleEditTriggerText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.7,
  },
  scheduleEditSubtext: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  scheduleEditor: {
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  scheduleHint: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  signatureCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: layout.cardInset,
    marginBottom: spacing.md,
    overflow: 'hidden',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  signatureCardPaused: {
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  signatureAccent: {
    position: 'absolute',
    left: 0,
    top: 22,
    bottom: 22,
    width: 3,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  signatureTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  signatureHeaderText: { flex: 1, minWidth: 0, gap: 6 },
  signatureCategory: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  signatureName: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  signatureAmount: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textTransform: 'capitalize',
  },
  signatureDivider: { height: 1, backgroundColor: colors.border },
  signatureMeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  signatureMetaColumn: { flex: 1, minWidth: 0, gap: 5 },
  signatureStockColumn: {
    flexShrink: 1,
    alignItems: 'flex-end',
    maxWidth: '43%',
    gap: 5,
  },
  signatureMetaLabel: {
    color: colors.subtle,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  signatureMetaValue: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  signatureStock: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  signatureLow: { color: colors.warning },
  signatureReservoir: { gap: 7 },
  signatureReservoirTrack: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  signatureReservoirFill: { height: '100%', borderRadius: radius.pill },
  signatureReservoirFoot: {
    color: colors.subtle,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  signatureActions: { flexDirection: 'row', gap: 9 },
  signatureEditButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    borderColor: colors.accentBorder,
    borderWidth: 1,
  },
  signatureEditText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signaturePauseButton: {
    minWidth: 92,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  signaturePauseText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  protocolDateBand: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  protocolDateColumn: { flex: 1, minWidth: 0, gap: 5 },
  protocolDateText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  protocolEditPanel: {
    gap: 11,
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderColor: colors.accentBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  protocolEditTrigger: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  protocolEditTriggerText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  protocolEditHint: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  primaryInline: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
  },
  protocolActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
  },
  secondaryActionText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  archiveAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  archiveActionText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  protocolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 0,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activateButton: {
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  activateText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.7,
  },
  mapCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: spacing.md,
    borderWidth: 0,
    borderColor: 'transparent',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  mapTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  mapLegendPill: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapLegendText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
    marginTop: spacing.lg,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 2,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayColumnToday: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  mapDayLabel: {
    color: colors.subtle,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  mapDayLabelToday: { color: colors.accent },
  mapDayNumber: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  mapDayNumberToday: { color: colors.accent },
  loadTrack: {
    height: 34,
    width: 5,
    justifyContent: 'flex-end',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: 7,
  },
  loadFill: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  loadFillEmpty: { height: 2, backgroundColor: colors.subtle },
  mapCount: {
    color: colors.subtle,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 5,
    fontVariant: ['tabular-nums'],
  },
  mapCountActive: { color: colors.accent },
  mapDetailsToggle: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mapDetailsToggleText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.accent,
  },
  mapScheduleList: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mapScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
  },
  mapScheduleDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  mapScheduleDay: { width: 38, alignItems: 'center' },
  mapScheduleDayText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  mapScheduleDate: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  mapScheduleItems: { color: colors.text, fontSize: 13, fontWeight: '800' },
  mapScheduleMeta: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  addItemLaunch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    padding: layout.cardInset,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  addIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  addIconText: { color: colors.accent, fontSize: 23, lineHeight: 27 },
  chevron: { color: colors.subtle, fontSize: 28 },
  builderCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.xl,
    padding: layout.cardInset,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  builderTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 5,
  },
  progress: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: { height: 3, backgroundColor: colors.accent, borderRadius: 2 },
  builderSummary: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  builderSummaryName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  builderNav: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  reviewBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  reviewName: { color: colors.text, fontSize: 20, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
