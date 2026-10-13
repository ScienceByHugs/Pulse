import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import policies from '@/content/legal.json';
import { colors, layout, radius, spacing, typography } from '@/theme';

export default function LegalScreen() {
  const router = useRouter();
  const [slug, setSlug] = useState<string | null>(null);
  const selected = policies.find((policy) => policy.slug === slug);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView key={slug ?? 'index'} contentContainerStyle={styles.page}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selected ? 'Back to policies' : 'Back'}
          onPress={() => (selected ? setSlug(null) : router.back())}
          style={styles.button}
        >
          <Text style={styles.link}>
            ← {selected ? 'All policies' : 'Back'}
          </Text>
        </Pressable>
        <Text style={styles.title}>{selected?.title ?? 'Legal & Privacy'}</Text>
        <Text style={styles.notice}>
          Draft for review. Mailing address, verified retention and attorney
          review are pending; these documents are not yet effective.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.card}
          onPress={() =>
            void Linking.openURL(
              'mailto:legal@sciencebyhugs.com?subject=Pulse%20privacy%20request',
            ).catch(() =>
              Alert.alert(
                'Privacy and legal contact',
                'Email legal@sciencebyhugs.com from your email app. Never send passwords or health records.',
              ),
            )
          }
        >
          <Text style={styles.heading}>Contact us about your privacy</Text>
          <Text style={styles.body}>
            Opens your email app. Include your account email and request type.
            Never send passwords or health records. Nothing is sent
            automatically.
          </Text>
        </Pressable>
        {selected
          ? selected.sections.map((section) => (
              <View key={section.heading} style={styles.section}>
                <Text style={styles.heading}>{section.heading}</Text>
                <Text selectable style={styles.body}>
                  {section.body}
                </Text>
              </View>
            ))
          : policies.map((policy) => (
              <Pressable
                key={policy.slug}
                accessibilityRole="button"
                onPress={() => setSlug(policy.slug)}
                style={styles.card}
              >
                <Text style={styles.heading}>{policy.title}</Text>
                <Text style={styles.link}>Read document →</Text>
              </Pressable>
            ))}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: {
    padding: layout.pageInset,
    paddingBottom: layout.pageBottom,
    gap: spacing.md,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  title: { ...typography.pageTitle, color: colors.text },
  heading: { ...typography.cardTitle, color: colors.text },
  body: { ...typography.body, color: colors.muted },
  notice: { ...typography.detail, color: colors.accent },
  link: { ...typography.button, color: colors.accent },
  button: { minHeight: 44, justifyContent: 'center' },
  section: { gap: spacing.sm, marginTop: spacing.md },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: layout.cardInset,
    gap: spacing.sm,
  },
});
