import { useWindowDimensions } from 'react-native';
import { ReportSheet } from '@/components/ReportSheet';
import { checkinTrends } from '@/domain/checkinTrends';
import { listCheckIns, type CheckIn } from '@/services/checkins';
import {
  listItemVersions,
  listProtocolItems,
  type ItemVersion,
} from '@/services/pulse';
import { PageHeader } from '@/components/PageHeader';
import { OrbitalBackground } from '@/components/OrbitalBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/theme';
import { PulseMenu } from '@/components/PulseMenu';
import {
  listDoseLogs,
  listTodayItems,
  type TimelineEntry,
  type TodayItem,
} from '@/services/pulse';
import {
  calculateSevenDayConsistency,
  calculateSupplyForecast,
  siteRotationSummary,
} from '@/domain/insights';
import { isDueOnDate } from '@/domain/schedule';

export default function InsightsScreen() {
  const { fontScale } = useWindowDimensions();
  const [historyItems, setHistoryItems] = useState<TodayItem[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [versions, setVersions] = useState<ItemVersion[]>([]);
  const [items, setItems] = useState<TodayItem[]>([]);
  const [logs, setLogs] = useState<TimelineEntry[]>([]);

  const load = useCallback(async () => {
    try {
      const [
        nextItems,
        nextLogs,
        nextCheckins,
        nextVersions,
        nextHistoryItems,
      ] = await Promise.all([
        listTodayItems(),
        listDoseLogs(1000),
        listCheckIns(),
        listItemVersions(),
        listProtocolItems(),
      ]);
      setCheckins(nextCheckins);
      setVersions(nextVersions);
      setHistoryItems(nextHistoryItems);
      setItems(nextItems);
      setLogs(nextLogs);
    } catch (error) {
      Alert.alert(
        'Could not load insights',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const consistency = useMemo(
    () =>
      calculateSevenDayConsistency(historyItems, logs, new Date(), versions),
    [historyItems, logs, versions],
  );
  const supply = useMemo(
    () => calculateSupplyForecast(items, logs),
    [items, logs],
  );
  const rotation = useMemo(() => siteRotationSummary(logs), [logs]);

  const routineFingerprint = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return items.slice(0, 4).map((item) => ({
      id: item.id,
      name: item.name,
      days: Array.from({ length: 7 }, (_, offset) => {
        const date = new Date(today);
        date.setDate(today.getDate() + offset);
        return isDueOnDate(item.schedule, date);
      }),
    }));
  }, [items]);

  const fingerprintLabels = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      return date
        .toLocaleDateString(undefined, { weekday: 'short' })
        .slice(0, 1)
        .toUpperCase();
    });
  }, []);

  const nextSupply = supply[0];
  const consistencyWidth =
    `${Math.max(0, Math.min(100, consistency.percent))}%` as `${number}%`;

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
        showsVerticalScrollIndicator={false}
      >
        <PulseMenu />
        <PageHeader
          title="Insights"
          description="Your logged activity and estimated supply."
        />

        <ReportSheet />
        <View style={styles.heroMetric}>
          <Text style={styles.cardTitle}>Your daily observations</Text>
          <Text style={styles.detail}>
            Average of your reported values over the last 7 days. Comparisons
            use the previous 7 days; they do not show what caused a change.
          </Text>
          {checkinTrends(checkins).map((trend) => (
            <View key={trend.field} style={{ paddingVertical: 12 }}>
              <Text style={styles.cardTitle}>
                {trend.field[0]?.toUpperCase()}
                {trend.field.slice(1)} ·{' '}
                {trend.mean === null
                  ? 'No entries'
                  : `${trend.mean.toFixed(1)}${trend.field === 'sleep' ? ' hours' : ' / 5'}`}
              </Text>
              <Text style={styles.detail}>
                {trend.count} reported {trend.count === 1 ? 'value' : 'values'}{' '}
                ·{' '}
                {trend.delta === null
                  ? 'More check-ins needed for comparison'
                  : `${trend.delta >= 0 ? '+' : ''}${trend.delta.toFixed(1)} compared with the prior week (${trend.previousCount} values)`}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.heroMetric}>
          <View style={styles.heroMetricTop}>
            <View>
              <Text style={styles.metricLabel}>7-day record</Text>
              <Text style={styles.heroMetricValue}>{consistency.percent}%</Text>
            </View>
            <View style={styles.metricBadge}>
              <Text style={styles.metricBadgeText}>
                {consistency.completed}/{consistency.due}
              </Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: consistencyWidth }]} />
          </View>
          <Text style={styles.metricDetail}>
            {consistency.due
              ? 'Based on recorded schedule versions; dates without a saved version are excluded.'
              : 'Your consistency view will populate as scheduled activity is logged.'}
          </Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{items.length}</Text>
            <Text style={styles.metricLabel}>Active substances</Text>
            <Text style={styles.metricDetail}>
              Currently participating in your active routine.
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{rotation.uniqueSites}</Text>
            <Text style={styles.metricLabel}>RECENT SITES</Text>
            <Text style={styles.metricDetail}>
              {rotation.administrations} site-tagged logs sampled.
            </Text>
          </View>
        </View>

        {routineFingerprint.length ? (
          <View style={styles.fingerprintCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.signalEyebrow}>ROUTINE FINGERPRINT</Text>
                <Text style={styles.cardTitle}>Your next 7 days</Text>
                <Text style={styles.detail}>
                  Each signal shows when an active item is scheduled to appear.
                </Text>
              </View>
            </View>
            <View style={styles.fingerprintHeaderRow}>
              <View style={styles.fingerprintNameSpacer} />
              {fingerprintLabels.map((label, index) => (
                <Text
                  key={`${label}-${index}`}
                  style={styles.fingerprintDayLabel}
                >
                  {label}
                </Text>
              ))}
            </View>
            {routineFingerprint.map((item, rowIndex) => (
              <View
                key={item.id}
                style={[
                  styles.fingerprintRow,
                  rowIndex > 0 && styles.fingerprintDivider,
                ]}
              >
                <Text style={styles.fingerprintName} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.days.map((active, index) => (
                  <View
                    key={`${item.id}-${index}`}
                    style={[
                      styles.fingerprintNode,
                      active && styles.fingerprintNodeActive,
                    ]}
                  >
                    {active ? <View style={styles.fingerprintCore} /> : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.signalEyebrow}>Inventory</Text>
              <Text style={styles.cardTitle}>What remains</Text>
              <Text style={styles.detail}>
                Projected from your recorded supply and schedule. NO DATE means
                the low threshold was not reached within 365 days.
              </Text>
            </View>
            {nextSupply ? (
              <Text style={styles.sectionCount}>{supply.length}</Text>
            ) : null}
          </View>
          {supply.length ? (
            supply.slice(0, 3).map((item, index) => (
              <View
                key={item.itemId}
                style={[styles.supplyRow, index > 0 && styles.supplyDivider]}
              >
                <View style={styles.supplyIdentity}>
                  <Text style={styles.supplyName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.supplyAmount}>
                    {item.remaining} {item.unit}
                  </Text>
                </View>
                <View style={styles.reservoir}>
                  <View style={styles.reservoirLabels}>
                    <Text style={styles.reservoirLabel}>CAPACITY</Text>
                    <Text
                      style={[
                        styles.reservoirPercentage,
                        item.projectedLowInDays === 0 && styles.warningText,
                      ]}
                    >
                      {item.total > 0
                        ? `${Math.round(Math.max(0, Math.min(100, (item.remaining / item.total) * 100)))}%`
                        : '—'}
                    </Text>
                  </View>
                  <View style={styles.reservoirRail}>
                    <View
                      style={[
                        styles.reservoirFill,
                        {
                          width:
                            `${Math.max(0, Math.min(100, item.total > 0 ? (item.remaining / item.total) * 100 : 0))}%` as `${number}%`,
                        },
                        item.projectedLowInDays === 0 &&
                          styles.reservoirFillLow,
                      ]}
                    />
                  </View>
                  <View style={styles.supplyMeta}>
                    <Text style={styles.supplyDose}>
                      {item.dosesRemaining} entries
                    </Text>
                    <Text
                      style={[
                        styles.forecast,
                        item.projectedLowInDays === 0 && styles.warningText,
                      ]}
                    >
                      {item.projectedLowInDays === null
                        ? 'NO DATE'
                        : item.projectedLowInDays === 0
                          ? 'LOW NOW'
                          : `LOW IN ~${item.projectedLowInDays}D`}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.detail}>
              Add inventory to a protocol item to enable supply forecasting.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: layout.pageBottom },
  heroMetric: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: layout.cardInset,
    borderWidth: 0,
    borderColor: 'transparent',
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroMetricTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroMetricValue: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -2,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
    lineHeight: 48,
  },
  metricBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metricBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  metrics: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  metricCard: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: spacing.md,
    borderWidth: 0,
    borderColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metricValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 32,
  },
  metricLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  metricDetail: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  fingerprintCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: layout.cardInset,
    borderWidth: 0,
    borderColor: 'transparent',
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  signalEyebrow: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  fingerprintHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: 5,
  },
  fingerprintNameSpacer: { flex: 2.5 },
  fingerprintDayLabel: {
    flex: 1,
    color: colors.subtle,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '700',
  },
  fingerprintRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  fingerprintDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  fingerprintName: {
    flex: 2.5,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    paddingRight: 8,
  },
  fingerprintNode: {
    flex: 1,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fingerprintNodeActive: { opacity: 1 },
  fingerprintCore: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.accentSoft,
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: layout.cardInset,
    borderWidth: 0,
    borderColor: 'transparent',
    marginTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionHeaderCopy: { flex: 1, minWidth: 0 },
  sectionCount: {
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    minWidth: 30,
    textAlign: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    alignSelf: 'flex-start',
  },
  supplyRow: { paddingVertical: spacing.md, gap: spacing.sm },
  supplyIdentity: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  supplyName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  supplyAmount: {
    color: colors.muted,
    textAlign: 'right',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  reservoir: { gap: 7 },
  reservoirLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reservoirLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.subtle,
  },
  reservoirPercentage: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  reservoirRail: {
    height: 8,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  reservoirFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  reservoirFillLow: { backgroundColor: colors.warning },
  supplyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supplyDose: {
    color: colors.subtle,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  supplyDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  warningText: { color: colors.warning },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  detail: { color: colors.muted, marginTop: 7, lineHeight: 20 },
  forecast: {
    color: colors.accent,
    minWidth: 62,
    textAlign: 'right',
    marginTop: spacing.sm,
    lineHeight: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
