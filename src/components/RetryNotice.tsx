import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';
export function RetryNotice({
  title = 'Could not finish',
  message,
  onRetry,
  busy = false,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  busy?: boolean;
}) {
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{message}</Text>
      {onRetry && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          accessibilityState={{ disabled: busy }}
          onPress={onRetry}
          style={styles.button}
        >
          <Text style={styles.action}>{busy ? 'Retrying…' : 'Retry'}</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  detail: { color: colors.muted, lineHeight: 20 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  action: { color: colors.accent, fontWeight: '600' },
});
