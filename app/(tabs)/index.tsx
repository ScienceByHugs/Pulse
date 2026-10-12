import {
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
  type ComponentRef,
} from 'react';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, radius, spacing } from '@/theme';
import { PulseMenu } from '@/components/PulseMenu';
import { OrbitalBackground } from '@/components/OrbitalBackground';
import { SyncStatus } from '@/components/SyncStatus';
import { CheckInCard } from '@/components/CheckInCard';
import {
  listDoseLogs,
  listTodayItems,
  listProtocolItems,
  listProtocols,
  listItemVersions,
  quickLog,
  skipDose,
  undoDoseLog,
  type TodayItem,
  type TimelineEntry,
  type ItemVersion,
} from '@/services/pulse';
import {
  todayOccurrences,
  trackingId,
  type OccurrenceFields,
} from '@/domain/occurrences';
import { todayRecordState } from '@/domain/todayState';
import { preferredContainer, supplyEstimate } from '@/domain/inventory';
import { isNetworkError } from '@/domain/network';
import { rescheduleReminders, cancelOccurrenceReminder } from '@/lib/reminders';
import { updatePulseTodayWidget } from '@/lib/widgets';
import { useAuth } from '@/providers/AuthProvider';
import { useSync, cacheToday, cachedToday } from '@/providers/SyncProvider';
import { updateQuickLog } from '@/lib/outbox';
import { sitesForRoute } from '@/domain/sites';
import { calculateSevenDayConsistency } from '@/domain/insights';
type CardItem = TodayItem & OccurrenceFields;
export default function TodayScreen() {
  const { session } = useAuth();
  const sync = useSync();
  const router = useRouter();
  const params = useLocalSearchParams<{ item?: string; occurrence?: string }>();
  const [allItems, setItems] = useState<TodayItem[]>([]);
  const [logs, setLogs] = useState<TimelineEntry[]>([]);
  const [historyItems, setHistoryItems] = useState<TodayItem[]>([]);
  const [versions, setVersions] = useState<ItemVersion[]>([]);
  const [tracked, setTracked] = useState(0);
  const [paused, setPaused] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sites, setSites] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const shownTarget = useRef('');
  useEffect(() => {
    shownTarget.current = '';
  }, [params.item, params.occurrence]);
  const uid = session?.user.id;
  const load = useCallback(async () => {
    try {
      const [items, history, all, protocols, nextVersions] = await Promise.all([
        listTodayItems(),
        listDoseLogs(1000),
        listProtocolItems(),
        listProtocols(),
        listItemVersions(),
      ]);
      const pausedProtocols = new Set(
        protocols.filter((p) => p.status === 'paused').map((p) => p.id),
      );
      const data = {
        items,
        historyItems: all,
        logs: history,
        versions: nextVersions,
        tracked: all.filter((i) => !i.archived_at).length,
        paused: all.filter(
          (i) =>
            !i.archived_at &&
            (i.active === false || pausedProtocols.has(i.protocol_id)),
        ).length,
      };
      setItems(items);
      setHistoryItems(all);
      setLogs(history);
      setVersions(nextVersions);
      setTracked(data.tracked);
      setPaused(data.paused);
      setOffline(false);
      if (uid) await cacheToday(uid, data);
      await Promise.allSettled([
        rescheduleReminders(items, history, sync.pending),
        updatePulseTodayWidget(todayOccurrences(items).length, 'Open Pulse'),
      ]);
    } catch (error) {
      const cached = uid ? await cachedToday(uid) : null;
      if (isNetworkError(error) && cached) {
        setItems(cached.items);
        setHistoryItems(cached.historyItems ?? cached.items);
        setLogs(cached.logs);
        setVersions(cached.versions ?? []);
        setTracked(cached.tracked);
        setPaused(cached.paused);
        setOffline(true);
      } else if (!isNetworkError(error))
        Alert.alert(
          'Could not load Today',
          error instanceof Error
            ? error.message
            : ((error as { message?: string })?.message ?? 'Try again.'),
        );
      else setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [uid, sync.revision]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const items = useMemo(() => todayOccurrences(allItems), [allItems]);
  const state = todayRecordState(items, logs);
  const pending = new Map(
    sync.pending.flatMap((p) =>
      p.occurrenceKey ? [[p.occurrenceKey, p] as const] : [],
    ),
  );
  const estimates = useMemo(
    () =>
      new Map(
        allItems.map((item) => {
          const adjusted = {
            ...item,
            inventory_containers: item.inventory_containers?.map((c) => ({
              ...c,
              remaining_amount:
                Number(c.remaining_amount) -
                sync.pending
                  .filter(
                    (p) =>
                      p.inventoryContainerId === c.id &&
                      p.status !== 'skipped' &&
                      !logs.some(
                        (log) => log.client_event_id === p.clientEventId,
                      ),
                  )
                  .reduce((sum, p) => sum + p.amount, 0),
            })),
          };
          return [
            item.id,
            supplyEstimate(
              adjusted,
              new Date(),
              new Set([...state.resolvedIds, ...pending.keys()]),
            ),
          ];
        }),
      ),
    [allItems, logs, sync.pending],
  );
  const ordered = [...items].sort(
    (a, b) =>
      Number(
        state.resolvedIds.has(trackingId(a)) || pending.has(trackingId(a)),
      ) -
      Number(
        state.resolvedIds.has(trackingId(b)) || pending.has(trackingId(b)),
      ),
  );
  async function record(item: CardItem, skip = false) {
    if (busy) return;
    const key = trackingId(item);
    setBusy(key);
    try {
      const result = skip
        ? await skipDose(item)
        : await quickLog(item, sites[key]);
      await cancelOccurrenceReminder(key).catch(() => undefined);
      await sync.refresh().catch(() => undefined);
      if (!result.queued) await load();
      const message = result.queued
        ? 'Saved on your phone · waiting to sync'
        : skip
          ? 'Skipped · no stock used'
          : 'Log saved';
      setFeedback(message);
      AccessibilityInfo.announceForAccessibility(message);
    } catch (e) {
      await sync.refresh().catch(() => undefined);
      Alert.alert(
        'Could not save entry',
        e instanceof Error
          ? e.message
          : ((e as { message?: string })?.message ?? 'Try again.'),
      );
    } finally {
      setBusy(null);
    }
  }
  async function undo(item: CardItem) {
    if (busy || !uid) return;
    const key = trackingId(item);
    setBusy(key);
    try {
      const queued = pending.get(key);
      if (queued)
        await updateQuickLog(uid, queued.clientEventId, {
          undoRequested: true,
          needsReview: false,
          syncError: undefined,
        });
      else {
        const entry =
          logs.find((log) => log.occurrence_key === key) ||
          logs.find(
            (log) =>
              !log.occurrence_key &&
              log.protocol_item_id === item.id &&
              new Date(log.logged_at).toDateString() ===
                new Date().toDateString(),
          );
        if (!entry) throw new Error('Refresh Today to find this entry.');
        await undoDoseLog(entry);
      }
      await sync.refresh().catch(() => undefined);
      await load();
      setFeedback(
        queued
          ? 'Undo requested · will sync when connected'
          : 'Entry undone · stock restored where tracked',
      );
    } catch (e) {
      Alert.alert(
        'Could not undo',
        e instanceof Error ? e.message : 'Try again.',
      );
    } finally {
      setBusy(null);
    }
  }
  const name = String(
    session?.user.user_metadata?.first_name ??
      session?.user.user_metadata?.full_name ??
      '',
  ).split(/\s+/)[0];
  const consistency = calculateSevenDayConsistency(
    historyItems,
    logs,
    new Date(),
    versions,
  );
  return (
    <SafeAreaView style={styles.safe}>
      <OrbitalBackground />
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.page}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={colors.accent}
          />
        }
      >
        <PulseMenu />
        <Text style={styles.eyebrow}>Today</Text>
        <Text style={styles.title}>
          {name ? `Welcome back, ${name}.` : 'Your day, at a glance.'}
        </Text>
        <Text style={styles.detail}>
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {items.length} scheduled · {state.completed} logged ·{' '}
            {state.skipped} skipped
          </Text>
        </View>
        <SyncStatus />
        {offline && (
          <Text style={styles.warning}>
            {allItems.length
              ? 'Showing your last synced routine. Logging stays on your phone until it can sync.'
              : 'Connect once to load your routine before offline logging.'}
          </Text>
        )}
        {!!feedback && (
          <Text accessibilityLiveRegion="polite" style={styles.saved}>
            {feedback}
          </Text>
        )}
        {loading && !items.length && (
          <ActivityIndicator color={colors.accent} />
        )}
        {!loading && !items.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nothing scheduled today.</Text>
            <Text style={styles.detail}>
              {tracked
                ? 'Enjoy the space in your day. Your routine is in Protocol.'
                : 'Create your first protocol to start tracking.'}
            </Text>
            <Pressable
              style={styles.secondary}
              onPress={() => router.push('/(tabs)/protocol')}
            >
              <Text style={styles.actionText}>Open Protocol</Text>
            </Pressable>
          </View>
        )}
        {paused > 0 && (
          <Pressable
            style={styles.secondary}
            onPress={() => router.push('/(tabs)/protocol')}
          >
            <Text style={styles.actionText}>
              {paused} paused {paused === 1 ? 'substance' : 'substances'} ·
              Manage →
            </Text>
          </Pressable>
        )}
        {ordered.map((item) => {
          const key = trackingId(item);
          const q = pending.get(key);
          const resolved = state.resolvedIds.has(key);
          const inventory = preferredContainer(item);
          const estimate = estimates.get(item.id)!;
          const highlight =
            params.occurrence === key ||
            (!params.occurrence && params.item === item.id);
          return (
            <View
              onLayout={(event) => {
                if (highlight && shownTarget.current !== key) {
                  shownTarget.current = key;
                  const y = event.nativeEvent.layout.y;
                  requestAnimationFrame(() =>
                    scroll.current?.scrollTo({
                      y: Math.max(0, y - 16),
                      animated: true,
                    }),
                  );
                }
              }}
              key={key}
              style={[styles.card, highlight && styles.highlight]}
            >
              <View style={styles.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.eyebrow}>
                    {item.category ?? 'Tracked substance'}
                  </Text>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.detail}>
                    {item.dose_amount} {item.dose_unit} · {item.route}
                  </Text>
                </View>
                <Text style={styles.time}>{item.slotTime ?? 'Any time'}</Text>
              </View>
              <Text style={styles.detail}>
                {item.schedule.timeZone && item.schedule.timeZone !== 'local'
                  ? `Home time · ${item.timeZone}`
                  : 'Local time · follows your device'}
              </Text>
              {q ? (
                <Text style={q.needsReview ? styles.warning : styles.saved}>
                  {q.undoRequested
                    ? 'Undo waiting to sync'
                    : q.needsReview
                      ? 'Pending entry needs review'
                      : q.status === 'skipped'
                        ? 'Skip waiting to sync'
                        : 'Logged on your phone · waiting to sync'}
                </Text>
              ) : resolved ? (
                <Text style={styles.saved}>
                  {state.skippedIds.has(key)
                    ? 'Skipped · no stock used'
                    : 'Logged'}
                </Text>
              ) : null}
              {inventory && (
                <Text style={estimate.low ? styles.warning : styles.detail}>
                  Active container: {inventory.remaining_amount}{' '}
                  {inventory.unit} · {estimate.entries} entries in usable stock
                </Text>
              )}
              {!resolved && !q && item.site_rotation_enabled && (
                <Pressable
                  accessibilityRole="button"
                  style={styles.secondary}
                  onPress={() => {
                    const options = sitesForRoute(item.route);
                    const index = options.indexOf(sites[key] ?? '');
                    setSites((s) => ({
                      ...s,
                      [key]: options[(index + 1) % options.length] ?? '',
                    }));
                  }}
                >
                  <Text style={styles.actionText}>
                    {sites[key]
                      ? `Site: ${sites[key]} · Change`
                      : 'Add site (optional)'}
                  </Text>
                </Pressable>
              )}
              {!resolved && !q ? (
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.primary, { flex: 1 }]}
                    disabled={!!busy}
                    onPress={() => void record(item)}
                  >
                    <Text style={styles.primaryText}>
                      {busy === key
                        ? 'Saving…'
                        : `Log ${item.dose_amount} ${item.dose_unit}`}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.secondary}
                    disabled={!!busy}
                    onPress={() => void record(item, true)}
                  >
                    <Text style={styles.actionText}>Skip</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  style={styles.secondary}
                  disabled={!!busy || q?.undoRequested}
                  onPress={() => void undo(item)}
                >
                  <Text style={styles.actionText}>Undo this entry</Text>
                </Pressable>
              )}
            </View>
          );
        })}
        <CheckInCard />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>7-day record</Text>
          <Text style={styles.metric}>
            {consistency.completed}/{consistency.due}
          </Text>
          <Text style={styles.detail}>
            {consistency.skipped} skipped · {consistency.missed} not recorded.
            Based on saved schedule versions; older dates without versions are
            excluded.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: {
    padding: layout.pageInset,
    paddingBottom: layout.pageBottom,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  eyebrow: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  detail: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 4 },
  summary: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryText: { color: colors.text, fontSize: 14 },
  card: {
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  highlight: { borderColor: colors.accent },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  time: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  primaryText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  secondary: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
  },
  actionText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  saved: { color: colors.success, fontSize: 13, lineHeight: 20 },
  warning: { color: colors.warning, fontSize: 13, lineHeight: 20 },
  metric: { color: colors.text, fontSize: 28, fontWeight: '700' },
});
