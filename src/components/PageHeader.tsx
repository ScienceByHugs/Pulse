import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.lg },
  title: { ...typography.pageTitle, color: colors.text },
  description: { ...typography.body, color: colors.muted },
});
