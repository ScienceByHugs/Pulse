import { useWindowDimensions } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { eligibleManualItems } from '@/domain/manualTracking';
import { ManualLogSheet } from '@/components/ManualLogSheet';
import { groupToday, todayEmptyMessage } from '@/domain/todayPresentation';
import { RetryNotice } from '@/components/RetryNotice';
import { administrationLabel } from '@/domain/administration';
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
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, radius } from '@/theme';
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
  const { fontScale } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
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
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [sites, setSites] = useState<Record<string, string>>({});
  const [openSiteKey, setOpenSiteKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    'Logged today': true,
    'Skipped today': true,
  });
  const [manualItem, setManualItem] = useState<TodayItem | null>(null);
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const shownTarget = useRef('');
  useEffect(() => {
    shownTarget.current = '';
  }, [params.item, params.occurrence]);
  const uid = session?.user.id;
  const load = useCallback(async () => {
    setLoadError('');
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
        tracked: all.filter(
          (i) =>
            !i.archived_at &&
            protocols.some(
              (p) => p.id === i.protocol_id && p.status !== 'archived',
            ),
        ).length,
        paused: all.filter(
          (i) =>
            !i.archived_at &&
            protocols.some(
              (p) => p.id === i.protocol_id && p.status !== 'archived',
            ) &&
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
      } else {
        setOffline(isNetworkError(error));
        setLoadError(
          isNetworkError(error)
            ? 'Your routine could not be loaded. Check your connection and retry. Previously loaded records stay visible.'
            : 'Today could not refresh. Your saved records have not been changed. Retry or contact support if this continues.',
        );
      }
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
  const groups = groupToday(
    items,
    state.completedIds,
    state.skippedIds,
    new Set(pending.keys()),
  );
  const empty = todayEmptyMessage(allItems, tracked, paused);
  useEffect(() => {
    if (params.occurrence || params.item)
      setCollapsed({ 'Logged today': false, 'Skipped today': false });
  }, [params.occurrence, params.item]);
  const sections = [
    { title: 'Still to record', items: groups.remaining },
    { title: 'Waiting to sync', items: groups.waiting },
    { title: 'Logged today', items: groups.logged },
    { title: 'Skipped today', items: groups.skipped },
  ];
  const visibleSections = sections.filter(
    (section) => !collapsed[section.title],
  );
  const ordered = visibleSections.flatMap((section) => section.items);
  const headings = new Map(
    visibleSections
      .filter((section) => section.items.length)
      .map((section) => [
        trackingId(section.items[0]!),
        `${section.title} · ${section.items.length}`,
      ]),
  );
  async function record(item: CardItem, skip = false) {
    if (busy) return;
    const key = trackingId(item);
    setBusy(key);
    setActionError('');
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
      setActionError(
        'This entry could not be confirmed. Retry sync and refresh before recording again, so an existing pending entry is not duplicated.',
      );
    } finally {
      setBusy(null);
    }
  }
  async function undo(item: CardItem) {
    if (busy || !uid) return;
    const key = trackingId(item);
    setBusy(key);
    setActionError('');
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
      setActionError(
        'Undo could not be confirmed. Retry sync and refresh to check the saved status before trying again.',
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
        contentContainerStyle={[
          styles.page,
          {
            paddingBottom: layout.pageBottom + Math.max(0, fontScale - 1) * 24,
          },
        ]}
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
            {groups.remaining.length} remaining · {groups.logged.length} logged
            · {groups.skipped.length} skipped
            {groups.waiting.length ? ` · ${groups.waiting.length} pending` : ''}
          </Text>
        </View>
        <SyncStatus />
        {!!actionError && (
          <RetryNotice
            title="Check your entry status"
            message={actionError}
            busy={sync.syncing || !!busy}
            onRetry={() => {
              void sync
                .refresh(true)
                .then(load)
                .then(() => setActionError(''))
                .catch(() =>
                  setActionError(
                    'Still unable to sync. Your pending records remain on this device. Check your connection and retry.',
                  ),
                );
            }}
          />
        )}
        {!!loadError && (
          <RetryNotice
            title="Could not refresh Today"
            message={loadError}
            onRetry={() => {
              setLoading(true);
              void load();
            }}
            busy={loading}
          />
        )}
        {!loading && items.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              {groups.next
                ? 'NEXT SCHEDULED'
                : groups.remaining.length
                  ? 'STILL TO RECORD'
                  : groups.waiting.length
                    ? 'SAVED ON YOUR PHONE'
                    : 'TODAY’S RECORD'}
            </Text>
            <Text style={styles.cardTitle}>
              {groups.next
                ? `${groups.next.name} · ${new Date(groups.next.scheduledFor!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : groups.remaining.length
                  ? `${groups.remaining.length} ${groups.remaining.length === 1 ? 'entry' : 'entries'} remaining`
                  : groups.waiting.length
                    ? 'Waiting for sync confirmation'
                    : 'Today’s entries are recorded'}
            </Text>
            <Text style={styles.detail}>
              {groups.earlier
                ? `${groups.earlier} earlier scheduled ${groups.earlier === 1 ? 'entry has' : 'entries have'} no record yet. Log only what you actually did.`
                : groups.next
                  ? 'Shown in your device’s current time zone. Record your actual activity below.'
                  : groups.waiting.length
                    ? 'Pending entries stay on this device until the server confirms them.'
                    : 'Logged and skipped entries are shown separately below.'}
            </Text>
          </View>
        )}
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
        {!loading && !loadError && !items.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{empty.title}</Text>
            <Text style={styles.detail}>{empty.body}</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.secondary}
              onPress={() => router.push('/(tabs)/protocol')}
            >
              <Text style={styles.actionText}>{empty.action}</Text>
            </Pressable>
          </View>
        )}
        {paused > 0 && (
          <Pressable
            accessibilityRole="button"
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
                      animated: !reduceMotion,
                    }),
                  );
                }
              }}
              key={key}
              style={styles.entryGroup}
            >
              {headings.has(key) && (
                <Pressable
                  accessibilityRole={resolved && !q ? 'button' : undefined}
                  accessibilityState={{
                    expanded: resolved && !q ? true : undefined,
                  }}
                  disabled={!(resolved && !q)}
                  onPress={() => {
                    const section = sections.find(
                      (s) => s.items[0] && trackingId(s.items[0]) === key,
                    );
                    if (
                      section &&
                      ['Logged today', 'Skipped today'].includes(section.title)
                    )
                      setCollapsed((c) => ({ ...c, [section.title]: true }));
                  }}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text accessibilityRole="header" style={styles.sectionTitle}>
                    {headings.get(key)}
                    {resolved && !q ? ' ▴' : ''}
                  </Text>
                </Pressable>
              )}
              <View style={[styles.card, highlight && styles.highlight]}>
                <View style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.eyebrow}>
                      {item.category ?? 'Tracked substance'}
                    </Text>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.detail}>
                      {item.dose_amount} {item.dose_unit} ·{' '}
                      {administrationLabel(item.route)}
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
                    {inventory.unit} · {estimate.entries} entries in usable
                    stock
                  </Text>
                )}
                {!resolved && !q && sitesForRoute(item.route).length > 0 && (
                  <View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Injection site for ${item.name}: ${sites[key] || 'Not recorded'}`}
                      accessibilityState={{ expanded: openSiteKey === key }}
                      accessibilityHint="Opens the optional site choices"
                      disabled={!!busy}
                      style={styles.secondary}
                      onPress={() =>
                        setOpenSiteKey((current) =>
                          current === key ? null : key,
                        )
                      }
                    >
                      <Text style={styles.actionText}>
                        {sites[key]
                          ? `Site: ${sites[key]}`
                          : 'Select site (optional)'}{' '}
                        {openSiteKey === key ? '▴' : '▾'}
                      </Text>
                    </Pressable>
                    {openSiteKey === key && (
                      <View style={styles.siteDropdown}>
                        {['', ...sitesForRoute(item.route)].map((site) => (
                          <Pressable
                            key={site || 'none'}
                            accessibilityRole="button"
                            accessibilityState={{
                              selected: (sites[key] ?? '') === site,
                            }}
                            disabled={!!busy}
                            style={[
                              styles.siteOption,
                              (sites[key] ?? '') === site &&
                                styles.siteOptionSelected,
                            ]}
                            onPress={() => {
                              setSites((current) => ({
                                ...current,
                                [key]: site,
                              }));
                              setOpenSiteKey(null);
                            }}
                          >
                            <Text style={styles.actionText}>
                              {site || 'No site recorded'}
                              {(sites[key] ?? '') === site ? ' ✓' : ''}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
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
            </View>
          );
        })}
        {sections
          .filter((s) => collapsed[s.title] && s.items.length)
          .map((section) => (
            <Pressable
              key={section.title}
              accessibilityRole="button"
              accessibilityState={{ expanded: false }}
              style={styles.secondary}
              onPress={() =>
                setCollapsed((c) => ({ ...c, [section.title]: false }))
              }
            >
              <Text style={styles.actionText}>
                {section.title} · {section.items.length} ▾
              </Text>
            </Pressable>
          ))}
        {eligibleManualItems(allItems).length > 0 && (
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              As-needed substances
            </Text>
            <Text style={styles.detail}>
              No automatic due time. Record only activity that actually
              happened.
            </Text>
            {eligibleManualItems(allItems).map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                style={styles.secondary}
                onPress={() => setManualItem(item)}
              >
                <Text style={styles.actionText}>Record {item.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {manualItem && (
          <ManualLogSheet
            item={manualItem}
            onClose={() => setManualItem(null)}
            onSaved={() => {
              void sync.refresh().then(load);
              setFeedback(
                'Manual entry saved on this device. Check Sync status for confirmation.',
              );
            }}
          />
        )}
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
  entryGroup: { gap: 10 },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  siteDropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
  },
  siteOption: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  siteOptionSelected: { backgroundColor: colors.accentSoft },
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
