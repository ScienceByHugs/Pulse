import { todayRecordState } from '@/domain/todayState';
import { OrbitalBackground } from '@/components/OrbitalBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/theme';
import { PulseMenu } from '@/components/PulseMenu';
import { flushQuickLogOutbox, listDoseLogs, listTodayItems, listProtocolItems, listProtocols, skipDose, undoDoseLog, quickLog, type TimelineEntry, type TodayItem } from '@/services/pulse';
import { isDueOnDate, nextScheduledTimeToday, scheduleTime } from '@/domain/schedule';
import { sitesForRoute } from '@/domain/sites';
import { rescheduleReminders } from '@/lib/reminders';
import { notifyLowStock } from '@/lib/lowStock';
import { updatePulseTodayWidget } from '@/lib/widgets';
import { useAuth } from '@/providers/AuthProvider';
import { calculateSevenDayConsistency } from '@/domain/insights';

function timeLabel(value?: string) {
  if (!value) return 'Any time';
  const [hourText, minute = '00'] = value.split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}

export default function TodayScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const entrance = useRef(new Animated.Value(0)).current;
  const firstName = String(session?.user.user_metadata?.first_name ?? session?.user.user_metadata?.full_name ?? '').trim().split(/\s+/)[0] || '';
  const [trackedCount, setTrackedCount] = useState(0);
  const [pausedCount, setPausedCount] = useState(0);
  const [allItems, setAllItems] = useState<TodayItem[]>([]);
  const [todayLogs, setTodayLogs] = useState<TimelineEntry[]>([]);
  const [selectedSites, setSelectedSites] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [recentLogAt, setRecentLogAt] = useState<Record<string, number>>({});
  const [logFeedback, setLogFeedback] = useState<{ id: string; message: string } | null>(null);
  const completionPulse = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      await flushQuickLogOutbox();
      const [items, logs, tracked, protocols] = await Promise.all([listTodayItems(), listDoseLogs(1000), listProtocolItems(), listProtocols()]);
      setTrackedCount(tracked.filter(item => !item.archived_at).length);
      const pausedProtocols = new Set(protocols.filter(protocol => protocol.status === 'paused').map(protocol => protocol.id));
      setPausedCount(tracked.filter(item => !item.archived_at && (item.active === false || pausedProtocols.has(item.protocol_id))).length);
      setAllItems(items);
      setTodayLogs(logs);
      const dueItems = items.filter((item) => isDueOnDate(item.schedule));
      const nextWindow = nextScheduledTimeToday(dueItems.map((item) => item.schedule));
      const nextTime = nextWindow ? timeLabel(nextWindow) : dueItems.length ? 'Any time' : 'Open Pulse';
      // Optional native integrations must not prevent Today from loading when iOS rejects a notification trigger.
      const [reminderResult, widgetResult] = await Promise.allSettled([
        rescheduleReminders(items),
        updatePulseTodayWidget(dueItems.length, nextTime)
      ]);
      if (reminderResult.status === 'rejected') console.warn('Pulse reminders could not be scheduled:', reminderResult.reason);
      if (widgetResult.status === 'rejected') console.warn('Pulse widget update failed:', widgetResult.reason);
      // Notification failures must never block dashboard data or quick logging.
      try { await notifyLowStock(items); } catch { /* retry on next refresh */ }

    } catch (error) {
      Alert.alert('Could not load Today', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      entrance.stopAnimation();
      entrance.setValue(reduced ? 1 : 0);
      if (!reduced) Animated.timing(entrance, { toValue: 1, duration: 440, useNativeDriver: true }).start();
    }).catch(() => entrance.setValue(1));
  }, [load, entrance]));

  const items = useMemo(
    () => allItems
      .filter((item) => isDueOnDate(item.schedule))
      .sort((a, b) => (scheduleTime(a.schedule) ?? '99:99').localeCompare(scheduleTime(b.schedule) ?? '99:99')),
    [allItems]
  );

  const completion = useMemo(() => todayRecordState(items, todayLogs), [items, todayLogs]);

  const pendingItems = useMemo(() => items.filter((item) => !completion.resolvedIds.has(item.id)), [items, completion.resolvedIds]);
  const completedItems = useMemo(() => items.filter((item) => completion.resolvedIds.has(item.id)), [items, completion.resolvedIds]);

  const dayBrief = useMemo(() => {
    const lowSupply = allItems.filter((item) => {
      const inventory = item.inventory_containers?.find((container) => container.is_active);
      return inventory ? inventory.remaining_amount <= inventory.low_threshold : false;
    }).length;
    const timedItems = items.filter((item) => Boolean(scheduleTime(item.schedule)));
    const upcoming = nextScheduledTimeToday(items.filter((item) => !completion.resolvedIds.has(item.id)).map((item) => item.schedule));
    const untimedRemaining = items.some((item) => !scheduleTime(item.schedule) && !completion.resolvedIds.has(item.id));
    const nextTime = upcoming ? timeLabel(upcoming) : untimedRemaining ? 'ANY TIME' : items.length === 0 ? 'CLEAR' : completion.completed + completion.skipped === items.length ? 'COMPLETE' : 'NO WINDOW';
    return { lowSupply, nextTime, scheduled: timedItems.length };
  }, [allItems, items, completion.resolvedIds]);

  function cycleSite(item: TodayItem) {
    const options = sitesForRoute(item.route);
    if (!options.length) return;
    const current = selectedSites[item.id] ?? '';
    const index = Math.max(0, options.indexOf(current));
    const nextSite = options[(index + 1) % options.length];
    if (!nextSite) return;
    setSelectedSites((state) => ({ ...state, [item.id]: nextSite }));
  }

  async function log(item: TodayItem) {
    if (loggingId || recentLogAt[item.id]) return;
    try {
      setLoggingId(item.id);
      const result = await quickLog(item, selectedSites[item.id]);
      const loggedAt = Date.now();
      completionPulse.stopAnimation();
      completionPulse.setValue(0);
      Animated.sequence([
        Animated.timing(completionPulse, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(completionPulse, { toValue: 0, duration: 520, useNativeDriver: true })
      ]).start();
      setRecentLogAt((current) => ({ ...current, [item.id]: loggedAt }));
      setTimeout(() => {
        setRecentLogAt((current) => {
          if (current[item.id] !== loggedAt) return current;
          const next = { ...current };
          delete next[item.id];
          return next;
        });
      }, 5000);
      if (!result.queued) await load();
      setSelectedSites(current => { const next = { ...current }; delete next[item.id]; return next; });
      const message = result.queued ? 'Saved offline · will sync when connected' : 'Saved to your history';
      setLogFeedback({ id: item.id, message });
      AccessibilityInfo.announceForAccessibility(message);
    } catch (error) {
      Alert.alert('Could not log dose', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoggingId(null);
    }
  }

  async function resolveEntry(item: TodayItem, undo = false) {
    if (loggingId) return;
    setLoggingId(item.id);
    try {
      if (undo) {
        const today = new Date().toDateString();
        const entry = todayLogs.find(log => log.protocol_item_id === item.id && new Date(log.logged_at).toDateString() === today && (log.status === 'completed' || log.status === 'skipped'));
        if (!entry) throw new Error('Reload Today to find the latest entry.');
        await undoDoseLog(entry);
      } else await skipDose(item);
      setRecentLogAt(current => { const next = {...current}; delete next[item.id]; return next; });
      setLogFeedback(null);
      await load();
    } catch (error) { Alert.alert('Could not update entry', error instanceof Error ? error.message : 'Try again.'); }
    finally { setLoggingId(null); }
  }

  const consistency = useMemo(() => calculateSevenDayConsistency(allItems, todayLogs), [allItems, todayLogs]);
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={styles.safe}>
      <OrbitalBackground />
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
      >
        <PulseMenu />

        <Animated.View style={[styles.heroHeader, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          <Animated.View pointerEvents="none" style={[styles.completionPulse, {
            opacity: completionPulse.interpolate({ inputRange: [0, 1], outputRange: [0, .24] }),
            transform: [{ scale: completionPulse.interpolate({ inputRange: [0, 1], outputRange: [.72, 1.18] }) }]
          }]} />
          <Text style={styles.heroKicker}>Today</Text>
          <Text style={styles.greeting}>{firstName ? `Welcome back, ${firstName}.` : 'Welcome to Pulse.'}</Text>
          <Text style={styles.date}>{dateLabel}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCell}><Text style={styles.summaryNumber}>{items.length}</Text><Text style={styles.summaryLabel}>Scheduled today</Text></View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCell}><Text style={styles.summaryNumber}>{allItems.length}</Text><Text style={styles.summaryLabel}>Active substances</Text></View>
          </View>

          <Text style={styles.heroFooterText}>{pendingItems.length ? `${pendingItems.length} scheduled · not yet recorded` : items.length ? `${completion.completed} logged · ${completion.skipped} skipped` : 'No scheduled entries today'}</Text>
        </Animated.View>

        {!loading && pausedCount > 0 ? <Pressable accessibilityRole="button" style={{minHeight:44,justifyContent:'center'}} onPress={() => router.push('/(tabs)/protocol')}><Text style={styles.detail}>{pausedCount} paused {pausedCount === 1 ? 'substance' : 'substances'} · Manage in Protocol →</Text></Pressable> : null}
        {loading && allItems.length === 0 ? <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} /> : null}

        {!loading && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>Nothing scheduled today.</Text>
            <Text style={styles.detail}>{trackedCount ? 'An off-day or a paused routine is normal. Manage your schedule in Protocol.' : 'Create your first protocol in the Protocol tab to start tracking.'}</Text>
          </View>
        ) : null}

        {trackedCount === 0 && !loading ? <Pressable accessibilityRole="button" style={styles.createAction} onPress={() => router.push('/(tabs)/protocol')}><Text style={styles.createActionText}>Create your first protocol</Text><Text style={styles.createActionArrow}>↗</Text></Pressable> : null}

        {[...pendingItems, ...completedItems].map((item, index) => {
          const inventory = item.inventory_containers?.find((container) => container.is_active);
          const low = inventory ? inventory.remaining_amount <= inventory.low_threshold : false;
          const estimatedDoses = inventory && item.dose_amount > 0 ? Math.floor(inventory.remaining_amount / item.dose_amount) : null;
          const site = selectedSites[item.id];

          return (
            <View key={item.id}>
              <Text style={styles.sectionLabel}>{completion.skippedIds.has(item.id) ? 'Skipped today' : completion.completedIds.has(item.id) ? 'Logged today' : 'Scheduled'}</Text>
              <View style={[styles.heroCard, low && styles.lowCard, completion.completedIds.has(item.id) && styles.completedCard]}>
                <View style={styles.heroTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.substanceKind}>{item.category ?? 'Tracked substance'}</Text>
                    <Text style={styles.medName}>{item.name}</Text>
                    <Text style={styles.detail}>{item.dose_amount} {item.dose_unit} · {item.route}</Text>
                    {completion.resolvedIds.has(item.id) ? <Text style={styles.completedLabel}>{completion.skippedIds.has(item.id) ? 'SKIPPED · NO STOCK USED' : 'LOGGED TODAY'}</Text> : null}
                  </View>
                  <View style={styles.duePill}><Text style={styles.dueText}>{timeLabel(scheduleTime(item.schedule))}</Text></View>
                </View>

                {item.site_rotation_enabled ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Select a site to record" style={styles.siteRow} onPress={() => cycleSite(item)}>
                    <View>
                      <Text style={styles.smallLabel}>Recorded site</Text>
                      <Text style={styles.siteText}>{site ?? 'Choose the site you used'}</Text>
                    </View>
                    <Text style={styles.changeText}>{site ? 'Change' : 'Select'}</Text>
                  </Pressable>
                ) : null}

                {inventory ? (
                  <View style={styles.inventoryRow}>
                    <Text style={styles.inventoryText}>{inventory.remaining_amount} {inventory.unit} remaining</Text>
                    <Text style={[styles.inventoryText, low && styles.lowText]}>{low ? 'LOW' : estimatedDoses !== null ? `~${estimatedDoses} doses` : ''}</Text>
                  </View>
                ) : (
                  <Text style={styles.inventoryText}>Inventory not tracked</Text>
                )}

                <Pressable
                  style={[styles.primaryButton, Boolean(loggingId) && styles.disabled]}
                  disabled={Boolean(loggingId) || Boolean(recentLogAt[item.id])}
                  onPress={() => void log(item)}
                >
                  <Text style={styles.primaryButtonText}>{loggingId === item.id ? 'Logging…' : recentLogAt[item.id] ? 'Logged ✓' : completion.completedIds.has(item.id) ? 'Log another entry' : 'Log entry'}</Text>
                </Pressable>
                {!completion.resolvedIds.has(item.id) ? <Pressable accessibilityRole="button" disabled={Boolean(loggingId)} style={{minHeight:44,justifyContent:'center',alignItems:'center'}} onPress={() => Alert.alert('Skip today’s entry?', 'Record that you skipped it. Inventory will stay unchanged.', [{text:'Cancel',style:'cancel'},{text:'Skip today',onPress:()=>void resolveEntry(item)}])}><Text style={styles.changeText}>Skip today</Text></Pressable> : <Pressable accessibilityRole="button" disabled={Boolean(loggingId)} style={{minHeight:44,justifyContent:'center',alignItems:'center'}} onPress={() => Alert.alert('Undo latest entry?', 'Remove the latest entry for this substance today and restore any stock it used.', [{text:'Cancel',style:'cancel'},{text:'Undo entry',onPress:()=>void resolveEntry(item,true)}])}><Text style={styles.changeText}>Undo latest entry</Text></Pressable>}
                {logFeedback?.id === item.id ? <Text accessibilityRole="text" style={styles.inlineFeedback}>{logFeedback.message}</Text> : null}
              </View>
            </View>
          );
        })}
        <View style={styles.dashboardHeader}>
          <Text style={styles.dashboardTitle}>Your record</Text>
          <Text style={styles.dashboardHint}>Activity and supply at a glance.</Text>
        </View>
        <View style={styles.consistencyCard}>
          <Text style={styles.briefEyebrow}>Last 7 days</Text>
          <Text style={styles.consistencyValue}>{consistency.due ? `${consistency.completed}/${consistency.due}` : '—'}</Text>
          <Text style={styles.consistencyCaption}>{consistency.due ? 'Scheduled occurrences recorded' : 'No scheduled occurrences in this period'}</Text>
        </View>
        <View style={styles.dashboardSignals}>
          <View style={styles.briefCard}>
            <View style={styles.briefHeader}>
              <View>
                <Text style={styles.briefEyebrow}>Schedule & supply</Text>
                <Text style={styles.briefTitle}>{pendingItems.length ? 'Upcoming & inventory' : 'Inventory overview'}</Text>
              </View>
              <View style={[styles.briefStatus, items.length === 0 && styles.briefStatusClear]}>
                <Text style={styles.briefStatusText}>{items.length ? 'ACTIVE' : 'CLEAR'}</Text>
              </View>
            </View>
            <View style={styles.briefSignals}>
              <View style={styles.briefSignal}>
                <Text style={styles.briefValue}>{dayBrief.nextTime}</Text>
                <Text style={styles.briefLabel}>Next scheduled time</Text>
              </View>
              <View style={styles.briefSignalDivider} />
              <View style={styles.briefSignal}>
                <Text style={styles.briefValue}>{dayBrief.scheduled}</Text>
                <Text style={styles.briefLabel}>Timed entries</Text>
              </View>
              <View style={styles.briefSignalDivider} />
              <View style={styles.briefSignal}>
                <Text style={[styles.briefValue, dayBrief.lowSupply > 0 && styles.briefWarning]}>{dayBrief.lowSupply}</Text>
                <Text style={styles.briefLabel}>Low stock</Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: layout.pageBottom, gap: spacing.sm },
  completionPulse: { position: 'absolute', top: 56, alignSelf: 'center', width: 210, height: 210, borderRadius: 105, borderWidth: 1, borderColor: colors.accent },
  heroHeader: { marginBottom: spacing.md, paddingHorizontal: 2, paddingVertical: spacing.sm, backgroundColor: 'transparent', overflow: 'hidden' },
  heroKicker: { color: colors.muted, fontSize: 11, fontWeight: '600', letterSpacing: .3, marginBottom: 8 },
  heroFooterText: { color: colors.muted, fontSize: 13, fontWeight: '500', marginTop: 12 },
  substanceKind: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.3, marginBottom: 5 },
  createAction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56, backgroundColor: colors.accent, paddingHorizontal: spacing.md, borderRadius: radius.lg },
  createActionText: { color: colors.bg, fontSize: 12, fontWeight: '700', letterSpacing: .6 },
  createActionArrow: { color: colors.bg, fontSize: 23, fontWeight: '800' },
  dashboardHeader: { marginTop: spacing.lg },
  dashboardTitle: { color: colors.text, fontSize: 21, fontWeight: '700', letterSpacing: -.6 },
  dashboardHint: { color: colors.muted, fontSize: 12, marginTop: 3 },
  dashboardSignals: { gap: spacing.sm },
  consistencyCard: { padding: spacing.md, borderRadius: 0, backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent', borderBottomWidth: 1, borderBottomColor: colors.border, },
  consistencyValue: { color: colors.text, fontSize: 29, lineHeight: 35, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 5 },
  consistencyCaption: { color: colors.muted, fontSize: 11, marginTop: 3 },
  briefCard: { marginTop: spacing.sm, backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent', borderRadius: 0, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, },
  briefHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  briefEyebrow: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: .3 },
  briefTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 3 },
  briefStatus: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  briefStatusClear: { opacity: .72 },
  briefStatusText: { color: colors.accent, fontSize: 8, fontWeight: '700', letterSpacing: .9 },
  briefSignals: { flexDirection: 'row', alignItems: 'stretch', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  briefSignal: { flex: 1, minWidth: 0 },
  briefSignalDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 8 },
  briefValue: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  briefWarning: { color: colors.warning },
  briefLabel: { color: colors.subtle, fontSize: 7, fontWeight: '700', letterSpacing: .9, marginTop: 2 },
  greeting: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -.6, lineHeight: 34, maxWidth: 360 },
  date: { color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: 7 },
  summaryRow: { flexDirection: 'row', backgroundColor: 'transparent', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryCell: { flex: 1, paddingHorizontal: spacing.sm },
  summaryNumber: { color: colors.text, fontSize: 20, lineHeight: 23, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summaryLabel: { color: colors.muted, fontSize: 11, fontWeight: '500', letterSpacing: .2, marginTop: 3 },
  summaryDivider: { width: 1, backgroundColor: colors.border },
  sectionLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: .3, marginTop: spacing.md, marginBottom: 2 },
  heroCard: { backgroundColor: 'transparent', borderRadius: 0, padding: layout.cardInset, borderWidth: 0, borderColor: 'transparent', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, },
  lowCard: { borderColor: '#8f6b3d' },
  completedCard: { backgroundColor: 'transparent', borderColor: 'transparent' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  medName: { color: colors.text, fontSize: 20, fontWeight: '800', flexShrink: 1 },
  completedLabel: { color: colors.success, fontSize: 9, fontWeight: '700', letterSpacing: 1.1, marginTop: 7 },
  detail: { color: colors.muted, marginTop: 4, fontSize: 13, lineHeight: 19 },
  duePill: { backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, maxWidth: 95, alignItems: 'center' },
  dueText: { color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: .7, fontVariant: ['tabular-nums'] },
  siteRow: { backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smallLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.3 },
  siteText: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 3 },
  changeText: { color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  inventoryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  inventoryText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontVariant: ['tabular-nums'], flexShrink: 1 },
  lowText: { color: '#f6bd75', fontWeight: '700' },
  primaryButton: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 2 },
  inlineFeedback: { color: colors.success, fontSize: 12, marginTop: 5, textAlign: 'center', fontWeight: '700' },
  primaryButtonText: { color: '#03111f', fontWeight: '700', letterSpacing: 1.1 },
  emptyCard: { backgroundColor: 'transparent', borderRadius: 0, padding: layout.cardInset, borderWidth: 0, borderColor: 'transparent', marginTop: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  disabled: { opacity: .55 }
});
