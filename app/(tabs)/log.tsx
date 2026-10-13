import { useWindowDimensions } from 'react-native';
import { entryName, recordDay } from '@/domain/occurrences';
import {
  filterTimelineEntries,
  entriesForCalendarDay,
  groupTimelineByDay,
  recordedTimeLabel,
  timelineProtocolId,
} from '@/domain/timelinePresentation';
import { RetryNotice } from '@/components/RetryNotice';
import { ProtocolDatePicker } from '@/components/ProtocolPickers';
import { ReportSheet } from '@/components/ReportSheet';
import { SyncStatus } from '@/components/SyncStatus';
import { FormSheet } from '@/components/FormSheet';
import { PageHeader } from '@/components/PageHeader';
import { LogEditor } from '@/components/LogEditor';
import { OrbitalBackground } from '@/components/OrbitalBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, layout, radius, spacing, type } from '@/theme';
import { PulseMenu } from '@/components/PulseMenu';
import { localDateKey } from '@/domain/schedule';
import {
  listTimelineHistory,
  listProtocols,
  listProtocolItems,
  type TimelineEntry,
  type TodayItem,
} from '@/services/pulse';

type TrackedProtocol = {
  id: string;
  name: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
};

function dayKey(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function LogScreen() {
  const { fontScale } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [substanceFilter, setSubstanceFilter] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [throughDate, setThroughDate] = useState('');
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const loadVersion = useRef(0);
  const [historyTruncated, setHistoryTruncated] = useState(false);
  const [protocols, setProtocols] = useState<TrackedProtocol[]>([]);
  const [protocolItems, setProtocolItems] = useState<TodayItem[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [selectedYearMonth, setSelectedYearMonth] = useState<number | null>(
    null,
  );
  const [selectedWeekDay, setSelectedWeekDay] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<
    'day' | 'week' | 'month' | 'year' | 'cycle' | 'all'
  >('week');

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError('');
    try {
      const [history, nextProtocols, nextItems] = await Promise.all([
        listTimelineHistory(),
        listProtocols(),
        listProtocolItems(),
      ]);
      if (version !== loadVersion.current) return;
      setEntries(history.entries);
      setHistoryTruncated(history.truncated);
      setProtocols(nextProtocols);
      setProtocolItems(nextItems);
      setSelectedProtocol((previous) =>
        previous && nextProtocols.some((p) => p.id === previous)
          ? previous
          : (nextProtocols[0]?.id ?? null),
      );
      setLoaded(true);
    } catch (error) {
      if (version === loadVersion.current)
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Check your connection and try again.',
        );
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        loadVersion.current += 1;
      };
    }, [load]),
  );

  const matchingEntries = useMemo(
    () =>
      filterTimelineEntries(
        entries,
        {
          search,
          status: statusFilter,
          substance: substanceFilter,
          protocol: protocolFilter,
          from: fromDate,
          through: throughDate,
        },
        protocolItems,
      ),
    [
      entries,
      search,
      statusFilter,
      substanceFilter,
      protocolFilter,
      fromDate,
      throughDate,
      protocolItems,
    ],
  );
  const invalidDateRange = Boolean(
    fromDate && throughDate && throughDate < fromDate,
  );
  const filterCount = [
    statusFilter,
    substanceFilter,
    protocolFilter,
    fromDate,
    throughDate,
  ].filter(Boolean).length;

  const cycleEntries = useMemo(() => {
    if (!selectedProtocol) return [];
    const itemIds = new Set(
      protocolItems
        .filter((item) => item.protocol_id === selectedProtocol)
        .map((item) => item.id),
    );
    return matchingEntries.filter((entry) => {
      if (typeof entry.snapshot?.protocolId === 'string')
        return entry.snapshot.protocolId === selectedProtocol;
      if (!entry.protocol_item_id || !itemIds.has(entry.protocol_item_id))
        return false;
      return true;
    });
  }, [matchingEntries, protocolItems, selectedProtocol]);

  const monthDate = useMemo(() => {
    const date = new Date();
    date.setDate(1);
    date.setHours(12, 0, 0, 0);
    date.setMonth(date.getMonth() + monthOffset);
    return date;
  }, [monthOffset]);

  const monthGrid = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const dayCount = new Date(year, month + 1, 0).getDate();
    const counts = new Map<string, number>();
    for (const entry of matchingEntries) {
      const key = recordDay(entry);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const cells = Array.from(
      { length: Math.ceil((firstWeekday + dayCount) / 7) * 7 },
      (_, index) => {
        const day = index - firstWeekday + 1;
        if (day < 1 || day > dayCount) return null;
        const date = new Date(year, month, day, 12);
        const key = localDateKey(date);
        return {
          day,
          key,
          count: counts.get(key) ?? 0,
          today: key === localDateKey(),
        };
      },
    );
    return cells;
  }, [matchingEntries, monthDate]);

  const weekDays = useMemo(() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay() + weekOffset * 7);
    const counts = new Map<string, number>();
    for (const entry of matchingEntries) {
      const day = recordDay(entry);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = localDateKey(date);
      return {
        key,
        date: date.getDate(),
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        count: counts.get(key) ?? 0,
        today: key === localDateKey(),
      };
    });
  }, [matchingEntries, weekOffset]);

  const weekLabel = useMemo(() => {
    const start = weekDays[0]?.key;
    const end = weekDays[6]?.key;
    return start && end ? `${start} — ${end}` : '';
  }, [weekDays]);

  const yearValue = new Date().getFullYear() + yearOffset;
  const yearAtlas = useMemo(() => {
    const counts = Array.from({ length: 12 }, () => 0);
    const activeDays = Array.from({ length: 12 }, () => new Set<string>());
    for (const entry of matchingEntries) {
      const date = new Date(recordDay(entry) + 'T12:00:00');
      if (date.getFullYear() !== yearValue) continue;
      const month = date.getMonth();
      counts[month] = (counts[month] ?? 0) + 1;
      activeDays[month]?.add(localDateKey(date));
    }
    return counts.map((count, index) => ({
      index,
      label: new Date(yearValue, index, 1)
        .toLocaleDateString(undefined, { month: 'short' })
        .toUpperCase(),
      count,
      days: activeDays[index]?.size ?? 0,
    }));
  }, [matchingEntries, yearValue]);
  const maxYearCount = Math.max(1, ...yearAtlas.map((entry) => entry.count));

  const viewEntries = useMemo(() => {
    const now = new Date();
    if (viewMode === 'all') return matchingEntries;
    if (viewMode === 'year') {
      return matchingEntries.filter((entry) => {
        const date = new Date(recordDay(entry) + 'T12:00:00');
        return (
          date.getFullYear() === yearValue &&
          (selectedYearMonth === null || date.getMonth() === selectedYearMonth)
        );
      });
    }
    if (viewMode === 'week') {
      const start = weekDays[0]?.key;
      const end = weekDays[6]?.key;
      return matchingEntries.filter((entry) => {
        const logged = recordDay(entry);
        return selectedWeekDay
          ? logged === selectedWeekDay
          : !!start && !!end && logged >= start && logged <= end;
      });
    }
    if (viewMode === 'month') {
      return matchingEntries.filter((entry) => {
        const logged = recordDay(entry);
        return selectedDay
          ? logged === selectedDay
          : logged.slice(0, 7) === localDateKey(monthDate).slice(0, 7);
      });
    }
    if (viewMode === 'cycle') return cycleEntries;
    const today = localDateKey(now);
    return entriesForCalendarDay(matchingEntries, today);
  }, [
    matchingEntries,
    cycleEntries,
    viewMode,
    monthDate,
    selectedDay,
    weekDays,
    selectedWeekDay,
    yearValue,
    selectedYearMonth,
  ]);

  const filterItems = useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .filter((e) => e.protocol_item_id)
            .map((e) => [
              e.protocol_item_id!,
              {
                id: e.protocol_item_id!,
                name:
                  protocolItems.find((item) => item.id === e.protocol_item_id)
                    ?.name ?? entryName(e),
              },
            ]),
        ).values(),
      ),
    [entries, protocolItems],
  );
  const filterProtocols = useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .filter((e) => timelineProtocolId(e, protocolItems))
            .map((e) => [
              timelineProtocolId(e, protocolItems)!,
              {
                id: timelineProtocolId(e, protocolItems)!,
                name:
                  protocols.find(
                    (protocol) =>
                      protocol.id === timelineProtocolId(e, protocolItems),
                  )?.name ?? String(e.snapshot?.protocolName ?? 'Protocol'),
              },
            ]),
        ).values(),
      ),
    [entries, protocolItems, protocols],
  );
  const filteredEntries = viewEntries;
  const activity = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(now.getDate() - (6 - index));
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      const count = (
        viewMode === 'cycle' ? cycleEntries : matchingEntries
      ).filter((entry) => {
        const logged = new Date(recordDay(entry) + 'T12:00:00');
        return logged >= date && logged < next;
      }).length;
      return {
        key: localDateKey(date),
        label: date
          .toLocaleDateString(undefined, { weekday: 'short' })
          .slice(0, 1),
        count,
        today: index === 6,
      };
    });
  }, [matchingEntries, cycleEntries, viewMode]);
  const activityTotal = activity.reduce((sum, day) => sum + day.count, 0);

  const maxActivity = useMemo(
    () => Math.max(1, ...activity.map((day) => day.count)),
    [activity],
  );

  const groups = useMemo(
    () => groupTimelineByDay(filteredEntries),
    [filteredEntries],
  );

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
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={colors.accent}
          />
        }
      >
        <PulseMenu />
        <PageHeader
          title="Timeline"
          description="Review and correct your recorded history."
        />
        <SyncStatus />
        {!!loadError && (
          <RetryNotice
            title="Could not load Timeline"
            message={`${loadError}${loaded ? ' Your last loaded records are shown below.' : ''}`}
            busy={loading}
            onRetry={() => void load()}
          />
        )}
        <ReportSheet />
        <Text
          style={{ color: colors.text, fontWeight: '600', marginBottom: 8 }}
        >
          Search substance or protocol
        </Text>
        <TextInput
          accessibilityLabel="Search Timeline"
          placeholder="Search substance or protocol"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            setViewMode('all');
          }}
          style={{
            color: colors.text,
            fontSize: 16,
            padding: 14,
            borderRadius: radius.md,
            backgroundColor: colors.panel2,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 8,
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.muted }}
          >
            {loading && !loaded ? (
              'Loading your history…'
            ) : (
              <>
                {filteredEntries.length} matching{' '}
                {filteredEntries.length === 1 ? 'entry' : 'entries'}
                {historyTruncated ? ' in loaded history' : ''}
              </>
            )}
          </Text>
          {!!search && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSearch('')}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: colors.accent }}>Clear search</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Timeline filters, ${filterCount} active`}
          onPress={() => setFiltersOpen(true)}
          style={{
            minHeight: 44,
            padding: 12,
            borderRadius: radius.md,
            backgroundColor: colors.panel2,
          }}
        >
          <Text style={{ color: colors.accent }}>
            Filters{filterCount ? ` · ${filterCount} active` : ''} ▾
          </Text>
        </Pressable>
        {invalidDateRange && (
          <Text style={{ color: colors.warning }}>
            Check the date range in Filters.
          </Text>
        )}
        <FormSheet
          label="Timeline filters"
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
        >
          <Text style={{ color: colors.muted, lineHeight: 22 }}>
            Choose the records you want to review. Changes apply as you select
            them.
          </Text>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            Entry status
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['', 'completed', 'skipped', 'missed'].map((status) => (
              <Pressable
                key={status}
                accessibilityRole="button"
                accessibilityState={{ selected: statusFilter === status }}
                onPress={() => {
                  setStatusFilter(status);
                  setViewMode('all');
                }}
                style={{
                  minHeight: 44,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor:
                    statusFilter === status ? colors.accentSoft : colors.panel,
                }}
              >
                <Text style={{ color: colors.accent }}>
                  {status === 'completed'
                    ? 'Recorded'
                    : status === 'skipped'
                      ? 'Skipped'
                      : status === 'missed'
                        ? 'Not recorded'
                        : 'All statuses'}
                </Text>
              </Pressable>
            ))}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {[{ id: '', name: 'All substances' }, ...filterItems].map(
              (item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: substanceFilter === item.id }}
                  onPress={() => {
                    setSubstanceFilter(item.id);
                    setViewMode('all');
                  }}
                  style={{
                    minHeight: 44,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor:
                      substanceFilter === item.id
                        ? colors.accentSoft
                        : colors.panel,
                  }}
                >
                  <Text style={{ color: colors.accent }}>{item.name}</Text>
                </Pressable>
              ),
            )}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
          >
            {[{ id: '', name: 'All protocols' }, ...filterProtocols].map(
              (protocol) => (
                <Pressable
                  key={protocol.id}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: protocolFilter === protocol.id,
                  }}
                  onPress={() => {
                    setProtocolFilter(protocol.id);
                    setViewMode('all');
                  }}
                  style={{
                    minHeight: 44,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor:
                      protocolFilter === protocol.id
                        ? colors.accentSoft
                        : colors.panel,
                  }}
                >
                  <Text style={{ color: colors.accent }}>{protocol.name}</Text>
                </Pressable>
              ),
            )}
          </ScrollView>
          <ProtocolDatePicker
            label="From date (optional)"
            value={fromDate}
            optional
            onChange={(value) => {
              setFromDate(value);
              setViewMode('all');
            }}
          />
          <ProtocolDatePicker
            label="Through date (optional)"
            value={throughDate}
            optional
            onChange={(value) => {
              setThroughDate(value);
              setViewMode('all');
            }}
          />
          {invalidDateRange && (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: colors.warning }}
            >
              Through date must be on or after From date.
            </Text>
          )}
          {Boolean(
            search ||
              statusFilter ||
              substanceFilter ||
              protocolFilter ||
              fromDate ||
              throughDate,
          ) && (
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 44, justifyContent: 'center' }}
              onPress={() => {
                setSearch('');
                setStatusFilter('');
                setSubstanceFilter('');
                setProtocolFilter('');
                setFromDate('');
                setThroughDate('');
              }}
            >
              <Text style={{ color: colors.accent }}>
                Clear filters and search
              </Text>
            </Pressable>
          )}
        </FormSheet>
        {historyTruncated ? (
          <View style={styles.historyNotice}>
            <Text style={styles.historyNoticeTitle}>
              OLDER RECORDS MAY BE MISSING
            </Text>
            <Text style={styles.historyNoticeBody}>
              Showing the most recent 10,000 entries. Earlier dates may be
              incomplete.
            </Text>
          </View>
        ) : null}

        <View style={styles.modeStrip}>
          {(['day', 'week', 'month', 'year', 'cycle', 'all'] as const).map(
            (mode) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: viewMode === mode }}
                key={mode}
                style={[
                  styles.modeButton,
                  viewMode === mode && styles.modeButtonActive,
                ]}
                onPress={() => {
                  setViewMode(mode);
                  if (mode === 'month') setSelectedDay(null);
                  if (mode === 'week') setSelectedWeekDay(null);
                  if (mode === 'year') setSelectedYearMonth(null);
                }}
              >
                <Text
                  style={[
                    styles.modeText,
                    viewMode === mode && styles.modeTextActive,
                  ]}
                >
                  {mode.toUpperCase()}
                </Text>
              </Pressable>
            ),
          )}
        </View>
        {viewMode === 'year' ? (
          <View style={styles.yearAtlasCard}>
            <View style={styles.calendarHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.signalEyebrow}>Recorded activity</Text>
                <Text style={styles.yearAtlasHeading}>{yearValue}</Text>
                <Text style={styles.yearAtlasSubheading}>
                  A month-by-month view of your recorded history.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous year"
                style={styles.monthNav}
                onPress={() => {
                  setYearOffset((value) => value - 1);
                  setSelectedYearMonth(null);
                }}
              >
                <Text style={styles.monthNavText}>‹</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next year"
                style={styles.monthNav}
                onPress={() => {
                  setYearOffset((value) => value + 1);
                  setSelectedYearMonth(null);
                }}
              >
                <Text style={styles.monthNavText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.yearAtlasGrid}>
              {yearAtlas.map((month) => (
                <Pressable
                  key={month.index}
                  accessibilityRole="button"
                  accessibilityLabel={`${month.label} ${yearValue}: ${month.count} events on ${month.days} days`}
                  accessibilityState={{
                    selected: selectedYearMonth === month.index,
                  }}
                  style={[
                    styles.yearAtlasTile,
                    selectedYearMonth === month.index &&
                      styles.yearAtlasTileSelected,
                  ]}
                  onPress={() =>
                    setSelectedYearMonth((current) =>
                      current === month.index ? null : month.index,
                    )
                  }
                >
                  <View style={styles.yearAtlasTileTop}>
                    <Text
                      style={[
                        styles.yearAtlasMonth,
                        selectedYearMonth === month.index &&
                          styles.yearAtlasSelectedText,
                      ]}
                    >
                      {month.label}
                    </Text>
                    <Text style={styles.yearAtlasCount}>{month.count}</Text>
                  </View>
                  <View style={styles.yearAtlasTrack}>
                    <View
                      style={[
                        styles.yearAtlasFill,
                        {
                          width:
                            `${(month.count / maxYearCount) * 100}%` as `${number}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.yearAtlasDays}>
                    {month.days} ACTIVE {month.days === 1 ? 'DAY' : 'DAYS'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.calendarFoot}>
              {selectedYearMonth === null
                ? 'TAP A MONTH TO EXPLORE ITS ENTRIES'
                : `FILTERED TO ${yearAtlas[selectedYearMonth]?.label ?? ''} · TAP AGAIN TO SHOW YEAR`}
            </Text>
          </View>
        ) : null}
        {viewMode === 'week' ? (
          <View style={styles.weekGridCard}>
            <View style={styles.calendarHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.signalEyebrow}>Recorded activity</Text>
                <Text style={styles.weekGridTitle}>Your week at a glance</Text>
                <Text style={styles.weekGridRange}>{weekLabel}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous week"
                style={styles.monthNav}
                onPress={() => {
                  setWeekOffset((value) => value - 1);
                  setSelectedWeekDay(null);
                }}
              >
                <Text style={styles.monthNavText}>‹</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next week"
                style={styles.monthNav}
                onPress={() => {
                  setWeekOffset((value) => value + 1);
                  setSelectedWeekDay(null);
                }}
              >
                <Text style={styles.monthNavText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.weekGrid}>
              {weekDays.map((day) => (
                <Pressable
                  key={day.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.label}, ${day.key}, ${day.count} logged events`}
                  accessibilityState={{ selected: selectedWeekDay === day.key }}
                  style={[
                    styles.weekGridDay,
                    day.today && styles.weekGridToday,
                    selectedWeekDay === day.key && styles.weekGridSelected,
                  ]}
                  onPress={() =>
                    setSelectedWeekDay((value) =>
                      value === day.key ? null : day.key,
                    )
                  }
                >
                  <Text
                    style={[
                      styles.weekGridDayLabel,
                      day.today && styles.weekGridHighlight,
                    ]}
                  >
                    {day.label.toUpperCase()}
                  </Text>
                  <Text style={styles.weekGridDate}>{day.date}</Text>
                  <View
                    style={[
                      styles.weekGridTrack,
                      day.count > 0 && styles.weekGridTrackActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.weekGridFill,
                        {
                          height:
                            `${Math.min(100, day.count * 22)}%` as `${number}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.weekGridCount,
                      day.count > 0 && styles.weekGridHighlight,
                    ]}
                  >
                    {day.count}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.calendarFoot}>
              {selectedWeekDay
                ? `FILTERED · ${selectedWeekDay} · TAP AGAIN TO SHOW WEEK`
                : 'TAP A DAY TO REVIEW ITS LOGGED ENTRIES'}
            </Text>
          </View>
        ) : null}
        {viewMode === 'month' ? (
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.signalEyebrow}>
                  MONTHLY ACTIVITY / RECORD
                </Text>
                <Text style={styles.calendarMonth}>
                  {monthDate.toLocaleDateString(undefined, {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                style={styles.monthNav}
                onPress={() => {
                  setMonthOffset((value) => value - 1);
                  setSelectedDay(null);
                }}
              >
                <Text style={styles.monthNavText}>‹</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                style={styles.monthNav}
                onPress={() => {
                  setMonthOffset((value) => value + 1);
                  setSelectedDay(null);
                }}
              >
                <Text style={styles.monthNavText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <View key={index} style={styles.calendarCell}>
                  <Text style={styles.calendarWeekday}>{day}</Text>
                </View>
              ))}
              {monthGrid.map((cell, index) => (
                <View
                  key={cell?.key ?? `blank-${index}`}
                  style={styles.calendarCell}
                >
                  {cell ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${cell.key}, ${cell.count} recorded events`}
                      accessibilityState={{
                        selected: selectedDay === cell.key,
                      }}
                      onPress={() =>
                        setSelectedDay((current) =>
                          current === cell.key ? null : cell.key,
                        )
                      }
                      style={[
                        styles.calendarDay,
                        cell.today && styles.calendarToday,
                        selectedDay === cell.key && styles.calendarSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          (cell.count > 0 || selectedDay === cell.key) &&
                            styles.calendarDayTextActive,
                        ]}
                      >
                        {cell.day}
                      </Text>
                      <View
                        style={[
                          styles.calendarDot,
                          cell.count > 0 && styles.calendarDotActive,
                        ]}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
            <Text style={styles.calendarFoot}>
              {selectedDay
                ? `FILTERED · ${selectedDay} · TAP AGAIN TO SEE MONTH`
                : 'TAP A DATE TO VIEW ITS ENTRIES · DOTS MARK RECORDED ACTIVITY'}
            </Text>
          </View>
        ) : null}
        {viewMode === 'cycle' ? (
          <View style={styles.cycleSelector}>
            <Text style={styles.signalEyebrow}>SELECT PROTOCOL / CYCLE</Text>
            {protocols.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cycleOptions}
              >
                {protocols.map((protocol) => (
                  <Pressable
                    key={protocol.id}
                    onPress={() => setSelectedProtocol(protocol.id)}
                    style={[
                      styles.cyclePill,
                      selectedProtocol === protocol.id &&
                        styles.cyclePillActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: selectedProtocol === protocol.id,
                    }}
                  >
                    <Text
                      style={[
                        styles.cyclePillText,
                        selectedProtocol === protocol.id &&
                          styles.cyclePillTextActive,
                      ]}
                    >
                      {protocol.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.detail}>
                Create a protocol to explore its activity by cycle.
              </Text>
            )}
            <Text style={styles.cycleHint}>
              Showing the selected protocol’s recorded history, including
              earlier dates if its tracking window has since changed.
            </Text>
          </View>
        ) : null}
        <View style={styles.signalCard}>
          <View style={styles.signalHeader}>
            <View>
              <Text style={styles.signalEyebrow}>Recorded activity</Text>
              <Text style={styles.signalTitle}>
                {viewMode === 'cycle'
                  ? 'Cycle activity · last 7 days'
                  : 'Last 7 days · overview'}
              </Text>
            </View>
            <Text style={styles.signalTotal}>{activityTotal}</Text>
          </View>
          <View style={styles.signalStrip}>
            {activity.map((day) => (
              <View key={day.key} style={styles.signalDay}>
                <View style={styles.signalTrack}>
                  <View
                    style={[
                      styles.signalFill,
                      {
                        height: Math.max(
                          3,
                          Math.round((day.count / maxActivity) * 42),
                        ),
                      },
                      day.count === 0 && styles.signalFillEmpty,
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.signalLabel,
                    day.today && styles.signalLabelToday,
                  ]}
                >
                  {day.label}
                </Text>
                <Text
                  style={[
                    styles.signalCount,
                    day.count > 0 && styles.signalCountActive,
                  ]}
                >
                  {day.count}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {!loaded ? null : filteredEntries.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyDot} />
            <Text style={styles.cardTitle}>
              {entries.length && !invalidDateRange
                ? 'No entries match this view.'
                : viewMode === 'cycle'
                  ? 'No records for this cycle yet.'
                  : 'Your timeline starts here.'}
            </Text>
            <Text style={styles.detail}>
              {invalidDateRange
                ? 'Adjust the date range to review your records.'
                : entries.length
                  ? 'Try another date, change your filters, or select All to see more history.'
                  : 'Log an item from Today and its history will appear automatically.'}
            </Text>
          </View>
        ) : (
          groups.map(([day, dayEntries]) => (
            <View key={day} style={styles.group}>
              <Text style={styles.dayLabel}>
                {dayKey(day + 'T12:00:00').toUpperCase()}
              </Text>
              {dayEntries.map((entry, index) => (
                <View key={entry.id} style={styles.timelineRow}>
                  <View style={styles.rail}>
                    <View style={styles.dot} />
                    {index < dayEntries.length - 1 ? (
                      <View style={styles.line} />
                    ) : null}
                  </View>
                  <View style={styles.card}>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{entryName(entry)}</Text>
                        <Text style={styles.dose}>
                          {entry.amount} {entry.unit}
                          {entry.route ? ` · ${entry.route}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.time}>
                        {recordedTimeLabel(entry)}
                      </Text>
                    </View>
                    {!!entry.time_zone && (
                      <Text style={styles.site}>
                        Recorded time zone · {entry.time_zone}
                      </Text>
                    )}
                    {!!entry.snapshot?.protocolName && (
                      <Text style={styles.site}>
                        Protocol · {String(entry.snapshot.protocolName)}
                      </Text>
                    )}
                    {(!entry.snapshot ||
                      Boolean(entry.snapshot.historicalDetailsUnavailable)) && (
                      <Text style={styles.site}>
                        Older entry · original details unavailable
                      </Text>
                    )}
                    {entry.site ? (
                      <Text style={styles.site}>SITE · {entry.site}</Text>
                    ) : null}
                    <View style={styles.statusRow}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>
                        {(entry.status || 'logged').toUpperCase()}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${entryName(entry)}`}
                        style={{
                          minHeight: 44,
                          justifyContent: 'center',
                          paddingHorizontal: 12,
                          marginLeft: 'auto',
                        }}
                        onPress={() => setEditingEntry(entry)}
                      >
                        <Text style={styles.statusText}>Edit / Undo</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
      {editingEntry ? (
        <LogEditor
          key={editingEntry.id}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={load}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: layout.pageBottom },
  historyNotice: {
    backgroundColor: colors.bgElevated,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.lg,
    gap: 5,
  },
  historyNoticeTitle: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  historyNoticeBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  modeStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 14,
  },
  yearAtlasCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  yearAtlasHeading: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 36,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  yearAtlasSubheading: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },
  yearAtlasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  yearAtlasTile: {
    width: '47.5%',
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    minHeight: 93,
  },
  yearAtlasTileSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  yearAtlasTileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  yearAtlasMonth: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  yearAtlasSelectedText: { color: colors.accent },
  yearAtlasCount: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  yearAtlasTrack: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  yearAtlasFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  yearAtlasDays: {
    color: colors.subtle,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  weekGridCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderColor: 'transparent',
    borderWidth: 0,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekGridTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
    marginTop: 5,
  },
  weekGridRange: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 5,
    fontVariant: ['tabular-nums'],
  },
  weekGrid: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  weekGridDay: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
    minHeight: 135,
  },
  weekGridToday: { borderColor: colors.accentBorder },
  weekGridSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  weekGridDayLabel: { color: colors.subtle, fontSize: 8, fontWeight: '700' },
  weekGridDate: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  weekGridTrack: {
    width: 5,
    height: 43,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekGridTrackActive: { backgroundColor: colors.accentSoft },
  weekGridFill: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  weekGridCount: {
    color: colors.subtle,
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  weekGridHighlight: { color: colors.accent },
  calendarCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    borderColor: colors.accentBorder,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.lg,
  },
  calendarMonth: {
    fontSize: 22,
    lineHeight: 29,
    color: colors.text,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 5,
  },
  monthNav: {
    width: 44,
    height: 44,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavText: {
    color: colors.accent,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 3,
  },
  calendarWeekday: { color: colors.subtle, fontSize: 11, fontWeight: '700' },
  calendarDay: {
    minHeight: 44,
    width: '92%',
    maxWidth: 46,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  calendarToday: { borderColor: colors.accentBorder },
  calendarSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  calendarDayText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  calendarDayTextActive: { color: colors.text },
  calendarDot: {
    height: 4,
    width: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  calendarDotActive: { backgroundColor: colors.accent },
  calendarFoot: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 12,
    lineHeight: 16,
  },
  cycleSelector: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.lg,
    padding: layout.cardInset,
    marginBottom: spacing.md,
    gap: 10,
  },
  cycleOptions: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  cyclePill: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 42,
  },
  cyclePillActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  cyclePillText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  cyclePillTextActive: { color: colors.accent },
  cycleHint: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  modeButton: {
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
  },
  modeButtonActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  modeText: { fontSize: 8, fontWeight: '700', color: colors.muted },
  modeTextActive: { color: colors.accent },
  signalCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  signalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  signalEyebrow: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  signalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  signalTotal: {
    color: colors.accent,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  signalStrip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: spacing.lg,
  },
  signalDay: { flex: 1, alignItems: 'center' },
  signalTrack: {
    width: 10,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  signalFill: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  signalFillEmpty: { backgroundColor: colors.subtle, opacity: 0.45 },
  signalLabel: {
    color: colors.subtle,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 7,
  },
  signalLabelToday: { color: colors.accent },
  signalCount: {
    color: colors.subtle,
    fontSize: 8,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  signalCountActive: { color: colors.text },
  group: { marginBottom: spacing.lg },
  dayLabel: {
    color: colors.subtle,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: 24, alignItems: 'center' },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    marginTop: 22,
    zIndex: 2,
  },
  line: { width: 1, flex: 1, backgroundColor: colors.border, marginTop: -1 },
  card: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: spacing.md,
    borderWidth: 0,
    borderColor: 'transparent',
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  dose: {
    color: colors.muted,
    marginTop: 5,
    lineHeight: 19,
    textTransform: 'capitalize',
  },
  time: { color: colors.accent, fontWeight: '800', fontSize: 12 },
  site: {
    color: colors.subtle,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  statusText: {
    color: colors.subtle,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  emptyCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: spacing.xl,
    borderWidth: 0,
    borderColor: 'transparent',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emptyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    marginBottom: spacing.lg,
  },
  detail: { color: colors.muted, marginTop: 6, lineHeight: 20 },
});
