import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { OrbitalBackground } from '@/components/OrbitalBackground';
import { PulseMenu } from '@/components/PulseMenu';
import { colors, layout, radius, spacing, typography } from '@/theme';

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <OrbitalBackground />
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <PulseMenu />
        <Text style={styles.eyebrow}>YOUR RECORD. YOUR CONTROL.</Text>
        <Text style={styles.title}>About Pulse.</Text>
        <Text style={styles.body}>
          A personal record of the routine you enter, built by Science By Hugs.
        </Text>
        <View style={styles.card}>
          <Text style={styles.heading}>Track with context</Text>
          <Text style={styles.body}>
            Pulse records your schedules, quantities, inventory, and history.
            Reminders reflect those entries. A log or supply estimate does not
            confirm that a treatment is safe, effective, or appropriate.
          </Text>
          <Text style={styles.body}>
            Pulse does not diagnose, prescribe, choose an injection site, or
            recommend peptides or doses. Consult a qualified clinician before
            making medical decisions and follow your clinician or pharmacist’s
            instructions.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>Control what appears</Text>
          <Text style={styles.body}>
            Private notification text hides names and amounts by default. You
            can enable biometric app lock in Account & Privacy. Calendar sync is
            optional; entries use private titles unless you choose to include
            names.
          </Text>
          <Text style={styles.body}>
            Calendar entries can be visible to the provider and other people who
            can access that calendar. Review its sharing settings before
            syncing.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>Manage your records</Text>
          <Text style={styles.body}>
            Your synced records are stored with Pulse’s Supabase backend.
            Account & Privacy provides export and account deletion. An export
            may contain sensitive information; share it only with people or
            services you trust.
          </Text>
          <Text style={styles.body}>
            Copies you export or add to a phone calendar remain outside Pulse.
            To remove calendar entries created by Pulse, disconnect the calendar
            and choose to remove those entries before deleting your account.
          </Text>
        </View>
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
  },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.pageTitle, color: colors.text },
  heading: { ...typography.cardTitle, color: colors.text },
  body: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: layout.cardInset,
  },
});
