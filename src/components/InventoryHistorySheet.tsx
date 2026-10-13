import { useAuth } from '@/providers/AuthProvider';
import { useState, useRef, useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { FormSheet } from './FormSheet';
import { RetryNotice } from './RetryNotice';
import { listInventoryHistory } from '@/services/inventoryHistory';
import type { InventoryHistoryEvent } from '@/domain/inventoryHistory';
import type { TodayItem } from '@/services/pulse';
import { colors, radius } from '@/theme';
export function InventoryHistoryButton({ item }: { item: TodayItem }) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const owner = useRef(uid);
  owner.current = uid;
  useEffect(() => {
    setOpen(false);
    setRows([]);
  }, [uid]);
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const [rows, setRows] = useState<InventoryHistoryEvent[]>([]);
  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await listInventoryHistory(item.id);
      if (owner.current === uid) setRows(result);
    } catch {
      if (owner.current === uid)
        setError(
          'Stock history could not load. Check your connection and retry.',
        );
    } finally {
      if (owner.current === uid) setLoading(false);
    }
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Stock history for ${item.name}`}
        style={{ minHeight: 44, padding: 12 }}
        onPress={() => {
          setRows([]);
          setOpen(true);
          void load();
        }}
      >
        <Text style={{ color: colors.accent, fontWeight: '600' }}>
          View stock history →
        </Text>
      </Pressable>
      <FormSheet
        visible={open}
        label={`Stock history · ${item.name}`}
        onClose={() => {
          setOpen(false);
          setRows([]);
        }}
      >
        <Text style={{ color: colors.muted, lineHeight: 22 }}>
          Latest 100 saved records. Tracking entries show their current
          corrected amount/status; their displayed date is the original entry
          date. See each container for its current balance. Full stored records
          are available in your account export.
        </Text>
        {loading && <ActivityIndicator color={colors.accent} />}
        {!!error && (
          <RetryNotice
            title="Could not load stock history"
            message={error}
            busy={loading}
            onRetry={() => void load()}
          />
        )}
        {!loading && !error && !rows.length && (
          <Text style={{ color: colors.muted }}>No container history yet.</Text>
        )}
        {rows.map((row) => (
          <View
            key={row.id}
            style={{
              padding: 16,
              gap: 8,
              borderRadius: radius.md,
              backgroundColor: colors.panel,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              {row.title}
            </Text>
            <Text style={{ color: colors.muted }}>
              {new Date(row.at).toLocaleString()}
            </Text>
            <Text style={{ color: colors.text, lineHeight: 22 }}>
              {row.detail}
            </Text>
          </View>
        ))}
      </FormSheet>
    </>
  );
}
