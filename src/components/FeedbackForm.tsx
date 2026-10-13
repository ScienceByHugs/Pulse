import { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { FormSheet } from './FormSheet';
import { RetryNotice } from './RetryNotice';
import {
  feedbackCategories,
  type FeedbackCategory,
  type FeedbackRequest,
} from '@/domain/feedback';
import { FeedbackSendError, sendFeedback } from '@/services/feedback';
import { colors, radius, spacing, typography } from '@/theme';

export function FeedbackForm({
  owner,
  initialRequest,
  onClose,
  onSubmitted,
}: {
  owner: string;
  initialRequest: FeedbackRequest | null;
  onClose: () => void;
  onSubmitted: (draftCleared: boolean) => void;
}) {
  const [category, setCategory] = useState<FeedbackCategory>(
    initialRequest?.category ?? 'suggestion',
  );
  const [message, setMessage] = useState(initialRequest?.message ?? '');
  const [allowContact, setAllowContact] = useState(
    initialRequest?.allowContact ?? false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [held, setHeld] = useState(!!initialRequest);
  const [closeGuard, setCloseGuard] = useState(false);
  const request = useRef(initialRequest);
  const sending = useRef(false);
  const valid = message.trim().length >= 10 && message.trim().length <= 2000;
  async function send() {
    if (sending.current || !valid) return;
    sending.current = true;
    setBusy(true);
    setError('');
    if (!request.current)
      request.current = {
        id: Crypto.randomUUID(),
        category,
        message: message.trim(),
        allowContact,
        appVersion:
          Constants.nativeAppVersion ??
          Constants.expoConfig?.version ??
          'unknown',
        buildNumber: Constants.nativeBuildVersion ?? 'unknown',
        platform:
          Platform.OS === 'ios'
            ? 'ios'
            : Platform.OS === 'android'
              ? 'android'
              : 'web',
      };
    try {
      const result = await sendFeedback(owner, request.current);
      onSubmitted(result.draftCleared);
    } catch (e) {
      const saved =
        !!initialRequest || (e instanceof FeedbackSendError && e.draftSaved);
      setHeld(saved);
      if (!saved) request.current = null;
      setError(
        e instanceof Error
          ? e.message
          : 'Could not confirm your feedback. Retry the same ticket.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <FormSheet
      label="Send feedback"
      onClose={() => {
        if (!held && message.trim()) setCloseGuard(true);
        else onClose();
      }}
      busy={busy}
    >
      <Text accessibilityRole="header" style={styles.title}>
        Help shape Pulse
      </Text>
      <Text style={styles.body}>
        Tell us about the app. Please leave out health records, passwords and
        other sensitive details. Your tracking records and logs are never
        attached.
      </Text>
      {closeGuard && (
        <View style={styles.copy}>
          <Text style={styles.label}>Keep writing or discard?</Text>
          <Text style={styles.detail}>
            This message has not been sent. Closing will discard the text in
            this form.
          </Text>
          <View style={styles.categories}>
            <Pressable
              accessibilityRole="button"
              style={styles.chip}
              onPress={() => setCloseGuard(false)}
            >
              <Text style={styles.chipText}>Keep writing</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.chip}
              onPress={onClose}
            >
              <Text style={styles.chipText}>Discard unsent message</Text>
            </Pressable>
          </View>
        </View>
      )}
      {!!error && (
        <RetryNotice
          title="Feedback needs attention"
          message={error}
          busy={busy}
          onRetry={() => void send()}
        />
      )}
      {held && (
        <Text style={styles.detail}>
          This ticket is waiting for confirmation. Retry its original message
          before starting another; your submitted details stay unchanged.
        </Text>
      )}
      <Text style={styles.label}>What’s this about?</Text>
      <View style={styles.categories}>
        {feedbackCategories.map((item) => (
          <Pressable
            key={item.value}
            accessibilityRole="button"
            accessibilityState={{
              selected: category === item.value,
              disabled: busy || held,
            }}
            disabled={busy || held}
            style={[styles.chip, category === item.value && styles.selected]}
            onPress={() => setCategory(item.value)}
          >
            <Text style={styles.chipText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Your feedback</Text>
      <TextInput
        accessibilityLabel="Your feedback, 10 to 2,000 characters"
        style={styles.input}
        multiline
        textAlignVertical="top"
        maxLength={2000}
        editable={!busy && !held}
        value={message}
        onChangeText={setMessage}
        placeholder="What happened, or what would make Pulse easier to use?"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.detail}>
        {message.trim().length}/2,000 characters · minimum 10
      </Text>
      <View style={styles.contact}>
        <View style={styles.copy}>
          <Text style={styles.label}>You may contact me</Text>
          <Text style={styles.detail}>
            Share my verified account email for follow-up on this feedback. Off
            by default.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Share my account email for feedback follow-up"
          value={allowContact}
          disabled={busy || held}
          onValueChange={setAllowContact}
        />
      </View>
      <Text style={styles.detail}>
        Only your message, category, app version, build and platform are
        submitted. A reply email is included only when you opt in.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || !valid }}
        disabled={busy || !valid}
        onPress={() => void send()}
        style={[styles.button, (busy || !valid) && styles.disabled]}
      >
        <Text style={styles.buttonText}>
          {busy
            ? 'Sending…'
            : held
              ? 'Retry original feedback'
              : 'Send feedback'}
        </Text>
      </Pressable>
    </FormSheet>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.sectionTitle, color: colors.text },
  body: { ...typography.body, color: colors.muted },
  label: { ...typography.label, color: colors.text },
  detail: { ...typography.detail, color: colors.muted },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    padding: 12,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  selected: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  chipText: { ...typography.compactButton, color: colors.accent },
  input: {
    ...typography.input,
    minHeight: 156,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.panel2,
    color: colors.text,
  },
  contact: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  button: {
    minHeight: 48,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  buttonText: { ...typography.button, color: colors.bg, textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
