import { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { FeedbackForm } from '@/components/FeedbackForm';
import { PageHeader } from '@/components/PageHeader';
import { PulseMenu } from '@/components/PulseMenu';
import { RetryNotice } from '@/components/RetryNotice';
import { OrbitalBackground } from '@/components/OrbitalBackground';
import { readFeedbackDraft } from '@/lib/feedbackDrafts';
import { listMyFeedback, type FeedbackCursor } from '@/services/feedback';
import {
  feedbackCategories,
  feedbackStatusLabel,
  type FeedbackEntry,
  type FeedbackRequest,
} from '@/domain/feedback';
import { colors, layout, radius, spacing, typography } from '@/theme';

export default function FeedbackScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const owner = useRef(uid);
  owner.current = uid;
  const version = useRef(0);
  const [scopeOwner, setScopeOwner] = useState(uid);
  const scoped = scopeOwner === uid;
  const [rows, setRows] = useState<FeedbackEntry[]>([]);
  const [next, setNext] = useState<FeedbackCursor | null>(null);
  const [draft, setDraft] = useState<FeedbackRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [draftError, setDraftError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(
    async (more?: FeedbackCursor) => {
      if (!uid) return;
      const request = ++version.current;
      setLoading(true);
      setError('');
      setDraftError('');
      const [history, saved] = await Promise.allSettled([
        listMyFeedback(uid, more),
        readFeedbackDraft(uid),
      ]);
      if (owner.current !== uid || version.current !== request) return;
      if (history.status === 'fulfilled') {
        setRows((existing) =>
          more
            ? [
                ...existing,
                ...history.value.entries.filter(
                  (entry) => !existing.some((row) => row.id === entry.id),
                ),
              ]
            : history.value.entries,
        );
        setNext(history.value.next);
        setLoaded(true);
      } else
        setError(
          'Your feedback could not load. Retry to check its latest status.',
        );
      if (saved.status === 'fulfilled') setDraft(saved.value);
      else
        setDraftError(
          'Your saved feedback draft could not load. Retry before sending another message.',
        );
      setLoading(false);
    },
    [uid],
  );
  useFocusEffect(
    useCallback(() => {
      setScopeOwner(uid);
      setRows([]);
      setDraft(null);
      setDraftError('');
      setError('');
      setOpen(false);
      setLoaded(false);
      setNotice('');
      void load();
      return () => {
        version.current++;
        setOpen(false);
      };
    }, [load, uid]),
  );
  return (
    <SafeAreaView style={styles.safe}>
      <OrbitalBackground />
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
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
          title="Help & feedback"
          description="Share an idea, report a problem, or tell us how a change feels."
        />
        <Text style={styles.body}>
          Feedback reaches the Pulse team. For account or access help, email
          support@sciencebyhugs.com. Never include passwords or health records.
        </Text>
        {scoped && !!notice && (
          <Text accessibilityLiveRegion="polite" style={styles.success}>
            {notice}
          </Text>
        )}
        {scoped && !!draftError && (
          <RetryNotice
            title="Draft needs attention"
            message={draftError}
            busy={loading}
            onRetry={() => void load()}
          />
        )}
        <Pressable
          accessibilityRole="button"
          disabled={!scoped || loading || !!draftError || !uid}
          accessibilityState={{
            disabled: !scoped || loading || !!draftError || !uid,
          }}
          style={[styles.button, (loading || !!draftError) && styles.disabled]}
          onPress={() => setOpen(true)}
        >
          <Text style={styles.buttonText}>
            {scoped && draft ? 'Resume saved feedback' : 'Send feedback'}
          </Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.heading}>
          My feedback
        </Text>
        {scoped && !!error && (
          <RetryNotice
            title="Feedback unavailable"
            message={error}
            busy={loading}
            onRetry={() => void load()}
          />
        )}
        {loading && !loaded && (
          <Text style={styles.detail}>Loading your submissions…</Text>
        )}
        {scoped && loaded && rows.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your ideas have a place here</Text>
            <Text style={styles.body}>
              After you send feedback, its status appears here. Received means
              it reached us; Planned means it is being considered for
              development.
            </Text>
          </View>
        )}
        {(scoped ? rows : []).map((row) => (
          <View key={row.id} style={styles.card}>
            <View style={styles.top}>
              <Text style={styles.label}>
                {feedbackCategories.find((item) => item.value === row.category)
                  ?.label ?? 'Feedback'}
              </Text>
              <Text style={styles.status}>
                {feedbackStatusLabel(row.status)}
              </Text>
            </View>
            <Text selectable style={styles.message}>
              {row.message}
            </Text>
            <Text style={styles.detail}>
              {new Date(row.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}{' '}
              · Pulse {row.app_version} ({row.build_number})
            </Text>
          </View>
        ))}
        {scoped && !!next && (
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            style={styles.secondary}
            onPress={() => void load(next)}
          >
            <Text style={styles.link}>
              {loading ? 'Loading…' : 'Load older feedback'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
      {scoped && open && uid && (
        <FeedbackForm
          key={`${uid}:${draft?.id ?? 'new'}`}
          owner={uid}
          initialRequest={draft}
          onClose={() => {
            setOpen(false);
            void load();
          }}
          onSubmitted={(draftCleared) => {
            if (owner.current !== uid) return;
            setOpen(false);
            setNotice(
              draftCleared
                ? 'Feedback received. Thank you—its status is shown below.'
                : 'Feedback received. Local draft cleanup needs a retry; resuming the same ticket will not duplicate it.',
            );
            void load();
          }}
        />
      )}
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
  body: { ...typography.body, color: colors.muted },
  detail: { ...typography.detail, color: colors.muted },
  heading: {
    ...typography.sectionTitle,
    color: colors.text,
    marginTop: spacing.sm,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardTitle: { ...typography.cardTitle, color: colors.text },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: { ...typography.label, color: colors.text },
  status: { ...typography.caption, color: colors.accent },
  message: { ...typography.body, color: colors.text },
  button: {
    minHeight: 48,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  buttonText: { ...typography.button, color: colors.bg },
  secondary: { minHeight: 44, padding: 12, justifyContent: 'center' },
  link: { ...typography.button, color: colors.accent },
  success: { ...typography.body, color: colors.success },
  disabled: { opacity: 0.5 },
});
