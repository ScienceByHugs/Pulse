import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  eyebrow: string;
  title: string;
  body: string;
  cards: Array<{ title: string; detail: string }>;
};

export function SectionScreen({ eyebrow, title, body, cards }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.stack}>
          {cards.map((card) => (
            <View style={styles.card} key={card.title}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDetail}>{card.detail}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: spacing.lg, paddingBottom: 42 },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginTop: spacing.md,
  },
  title: { ...typography.hero, color: colors.text, marginTop: spacing.sm },
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  stack: { gap: spacing.sm },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { ...typography.cardTitle, color: colors.text },
  cardDetail: { ...typography.body, color: colors.muted, marginTop: 6 },
});
