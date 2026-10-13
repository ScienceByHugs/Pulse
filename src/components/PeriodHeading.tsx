import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

/** Period controls sit above the title so they never squeeze a wrapped heading. */
export function PeriodHeading({
  label,
  title,
  detail,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
}: {
  label: string;
  title: string;
  detail?: string;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.navigation}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={previousLabel}
            onPress={onPrevious}
            style={styles.arrow}
          >
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nextLabel}
            onPress={onNext}
            style={styles.arrow}
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {!!detail && <Text style={styles.detail}>{detail}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.lg },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: { ...typography.eyebrow, color: colors.accent, flex: 1, minWidth: 0 },
  navigation: { flexDirection: 'row', gap: spacing.sm },
  arrow: {
    minWidth: 44,
    minHeight: 44,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  arrowText: { color: colors.accent, fontSize: 26, lineHeight: 32 },
  copy: { gap: spacing.xs },
  title: { ...typography.sectionTitle, color: colors.text },
  detail: { ...typography.detail, color: colors.muted },
});
