import { PageHeader } from '@/components/PageHeader';
import { isValidEmail } from '@/domain/validation';
import { PulseBrand } from '@/components/PulseBrand';
import { OrbitalBackground } from '@/components/OrbitalBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, layout, radius, spacing, type } from '@/theme';
import { PulseMenu } from '@/components/PulseMenu';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import {
  getBiometricLockEnabled,
  getPrivateNotifications,
  getRemindersEnabled,
  getLowStockAlertsEnabled,
  setLowStockAlertsEnabled,
  setBiometricLockEnabled,
  setPrivateNotifications
} from '@/lib/privacy';
import { disableReminders, enableReminders, rescheduleReminders, sendTestNotification } from '@/lib/reminders';
import { listTodayItems } from '@/services/pulse';
import { clearLowStockAlertState, notifyLowStock } from '@/lib/lowStock';
import { requestReminderPermission } from '@/lib/reminders';
import { deletePulseAccount, exportPulseData } from '@/services/account';

export default function YouScreen() {
  const { session } = useAuth();
  const [biometricLock, setBiometricLock] = useState(false);
  const [privateNotifications, setPrivateNotificationsState] = useState(true);
  const [reminders, setReminders] = useState(false);
  const [lowStockAlerts, setLowStockAlerts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState(() => String(session?.user.user_metadata?.full_name ?? ''));
  const [savedName, setSavedName] = useState(() => String(session?.user.user_metadata?.full_name ?? ''));
  const [savingProfile, setSavingProfile] = useState(false);
  const [contactPhone, setContactPhone] = useState(() => String(session?.user.user_metadata?.contact_phone ?? ''));
  const [savedPhone, setSavedPhone] = useState(() => String(session?.user.user_metadata?.contact_phone ?? ''));
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);


  const load = useCallback(async () => {
    const [lock, privateMode, reminderMode, lowStockMode] = await Promise.all([
      getBiometricLockEnabled(),
      getPrivateNotifications(),
      getRemindersEnabled(),
      getLowStockAlertsEnabled()
    ]);
    setBiometricLock(lock);
    setPrivateNotificationsState(privateMode);
    setReminders(reminderMode);
    setLowStockAlerts(lowStockMode);
    const { data: { user } } = await supabase.auth.getUser();
    const currentName = String(user?.user_metadata?.full_name ?? '');
    setDisplayName(currentName);
    setSavedName(currentName);
    const phone = String(user?.user_metadata?.contact_phone ?? '');
    setContactPhone(phone);
    setSavedPhone(phone);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function saveProfile() {
    const name = displayName.trim();
    if (!name || name.length > 80) return Alert.alert('Check your name', 'Enter a name of up to 80 characters.');
    const phone = contactPhone.trim();
    if (phone.length > 30 || (phone && !/^[+0-9().\-\s]{7,30}$/.test(phone))) return Alert.alert('Check your phone', 'Enter a valid contact phone number, or leave it blank.');
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name, first_name: name.split(/\s+/)[0], contact_phone: phone } });
      if (error) throw error;
      setSavedName(name);
      setSavedPhone(phone);
      Alert.alert('Profile updated', 'Your welcome message will use your updated name.');
    } catch (error) {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function requestEmailChange() {
    const address = newEmail.trim().toLowerCase();
    if (!isValidEmail(address) || address === session?.user.email?.toLowerCase()) {
      return Alert.alert('Check new email', 'Enter a different, valid email address.');
    }
    if (accountBusy) return;
    setAccountBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: address }, { emailRedirectTo: 'pulse://auth/callback' });
      if (error) throw error;
      setNewEmail('');
      Alert.alert('Check your inbox', 'Your email change request was submitted. Follow the verification instructions sent by Supabase. Your sign-in email may not change until confirmation is complete.');
    } catch (error) {
      Alert.alert('Could not change email', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setAccountBusy(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 8) return Alert.alert('Check password', 'Use a password with at least 8 characters.');
    if (newPassword !== confirmPassword) return Alert.alert('Passwords differ', 'Both password fields must match.');
    if (accountBusy) return;
    setAccountBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your new password has been saved.');
    } catch (error) {
      Alert.alert('Could not update password', error instanceof Error ? error.message : 'You may need to sign in again or reauthenticate.');
    } finally {
      setAccountBusy(false);
    }
  }

  async function toggleLock(value: boolean) {
    if (!value) {
      await setBiometricLockEnabled(false);
      setBiometricLock(false);
      return;
    }

    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hardware && await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      Alert.alert('Biometrics unavailable', 'Set up Face ID, Touch ID, or device biometrics first.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable Pulse privacy lock',
      disableDeviceFallback: false
    });
    if (!result.success) return;

    await setBiometricLockEnabled(true);
    setBiometricLock(true);
  }

  async function toggleReminders(value: boolean) {
    setBusy(true);
    try {
      if (!value) {
        await disableReminders();
        setReminders(false);
        return;
      }

      const items = await listTodayItems();
      const enabled = await enableReminders(items);
      setReminders(enabled);
      if (!enabled) Alert.alert('Notifications are off', 'Enable notifications for Pulse in device settings to use reminders.');
    } catch (error) {
      Alert.alert('Could not update reminders', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function testNotification() {
    if (busy) return;
    setBusy(true);
    try {
      const scheduled = await sendTestNotification();
      Alert.alert(scheduled ? 'Test scheduled' : 'Notifications are disabled',
        scheduled
          ? 'A test notification is scheduled for 8 seconds from now. Lock the phone or leave Pulse to check the banner. iOS Focus settings may silence it.'
          : 'Enable notifications for Pulse in iPhone Settings → Notifications, then try again.');
    } catch (error) {
      Alert.alert('Notification test failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function toggleLowStockAlerts(value: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (value && !(await requestReminderPermission())) {
        Alert.alert('Notifications are off', 'Enable notifications for Pulse in device settings.');
        return;
      }
      await setLowStockAlertsEnabled(value);
      setLowStockAlerts(value);
      if (!value) {
        await clearLowStockAlertState();
      } else {
        await notifyLowStock(await listTodayItems());
      }
    } catch (error) {
      Alert.alert('Could not update supply alerts', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function togglePrivateNotifications(value: boolean) {
    setPrivateNotificationsState(value);
    await setPrivateNotifications(value);
    if (reminders) {
      const items = await listTodayItems();
      await rescheduleReminders(items);
    }
  }

  async function exportData() {
    setBusy(true);
    try {
      await exportPulseData();
    } catch (error) {
      Alert.alert('Could not export data', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete Pulse account?',
      'This permanently deletes your Pulse account and synced protocol, inventory, and log data. This cannot be undone. Shared exports and phone calendar copies remain outside Pulse. Disconnect your calendar first to remove its Pulse entries.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await deletePulseAccount();
              } catch (error) {
                Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Unknown error');
              } finally {
                setBusy(false);
              }
            })();
          }
        }
      ]
    );
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Could not sign out', error.message);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <OrbitalBackground />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <PulseMenu />
        <PageHeader title="Account" description="Your profile, privacy, and data." />

        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(savedName || session?.user.email || 'P').slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.label}>YOUR ACCOUNT</Text>
            <Text style={styles.value} selectable>{session?.user.email ?? 'Pulse user'}</Text>
          </View>
        </View>
        <View style={styles.profileEditor}>
          <Text style={styles.cardTitle}>Your profile</Text>
          <Text style={styles.detail}>Set the name and optional contact number shown in your private profile. This phone number is not verified for sign-in or text messages.</Text>
          <TextInput accessibilityLabel="Display name" autoCapitalize="words" autoCorrect={false} maxLength={80} style={styles.profileInput} placeholder="Your name" placeholderTextColor={colors.muted} value={displayName} onChangeText={setDisplayName} />
          <TextInput accessibilityLabel="Contact phone number, optional" keyboardType="phone-pad" autoComplete="tel" maxLength={30} style={styles.profileInput} placeholder="Contact phone (optional)" placeholderTextColor={colors.muted} value={contactPhone} onChangeText={setContactPhone} />
          <Pressable accessibilityRole="button" style={[styles.dataButton, (savingProfile || (displayName.trim() === savedName && contactPhone.trim() === savedPhone)) && styles.profileSaveDisabled]} disabled={savingProfile || (displayName.trim() === savedName && contactPhone.trim() === savedPhone)} onPress={() => void saveProfile()}><Text style={styles.dataButtonText}>{savingProfile ? 'Saving…' : 'SAVE PROFILE'}</Text></Pressable>
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT SECURITY</Text>
        <View style={styles.profileEditor}>
          <Text style={styles.cardTitle}>Change email</Text>
          <Text style={styles.detail}>Current sign-in email: {session?.user.email ?? '—'}. A new address may require confirmation through email.</Text>
          <TextInput accessibilityLabel="New account email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" style={styles.profileInput} placeholder="New email address" placeholderTextColor={colors.muted} value={newEmail} onChangeText={setNewEmail} />
          <Pressable accessibilityRole="button" disabled={accountBusy || !newEmail.trim()} style={[styles.dataButton, (accountBusy || !newEmail.trim()) && styles.profileSaveDisabled]} onPress={() => void requestEmailChange()}><Text style={styles.dataButtonText}>REQUEST EMAIL CHANGE</Text></Pressable>
          <View style={styles.divider} />
          <Text style={styles.cardTitle}>Change password</Text>
          <Text style={styles.detail}>Choose a new password with at least 8 characters. Supabase may require recent authentication.</Text>
          <TextInput accessibilityLabel="New account password" secureTextEntry autoComplete="new-password" style={styles.profileInput} placeholder="New password" placeholderTextColor={colors.muted} value={newPassword} onChangeText={setNewPassword} />
          <TextInput accessibilityLabel="Confirm account password" secureTextEntry autoComplete="new-password" style={styles.profileInput} placeholder="Confirm new password" placeholderTextColor={colors.muted} value={confirmPassword} onChangeText={setConfirmPassword} />
          <Pressable accessibilityRole="button" disabled={accountBusy || !newPassword || !confirmPassword} style={[styles.dataButton, (accountBusy || !newPassword || !confirmPassword) && styles.profileSaveDisabled]} onPress={() => void changePassword()}><Text style={styles.dataButtonText}>UPDATE PASSWORD</Text></Pressable>
        </View>

        <View style={styles.shieldCard}>
          <View style={styles.shieldTop}>
            <View>
              <Text style={styles.shieldEyebrow}>PRIVACY SHIELD</Text>
              <Text style={styles.shieldTitle}>Your privacy settings</Text>
            </View>

          </View>

          <View style={styles.shieldGrid}>
            <View style={styles.shieldSignal}>
              <View style={[styles.shieldDot, biometricLock && styles.shieldDotActive]} />
              <Text style={[styles.shieldSignalText, biometricLock && styles.shieldSignalTextActive]}>BIOMETRIC</Text>
            </View>
            <View style={styles.shieldSignal}>
              <View style={[styles.shieldDot, privateNotifications && styles.shieldDotActive]} />
              <Text style={[styles.shieldSignalText, privateNotifications && styles.shieldSignalTextActive]}>PRIVATE TEXT</Text>
            </View>
            <View style={styles.shieldSignal}>
              <View style={[styles.shieldDot, reminders && styles.shieldDotActive]} />
              <Text style={[styles.shieldSignalText, reminders && styles.shieldSignalTextActive]}>REMINDERS</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>PRIVACY & REMINDERS</Text>
        <View style={styles.card}>
          <SettingRow
            title="Biometric app lock"
            detail="Require Face ID, Touch ID, or device biometrics when Pulse opens."
            value={biometricLock}
            onValueChange={(value) => void toggleLock(value)}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Protocol reminders"
            detail="Schedule local reminders from your active protocol."
            value={reminders}
            disabled={busy}
            onValueChange={(value) => void toggleReminders(value)}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Private notification text"
            detail="Hide item names and amounts from notification previews."
            value={privateNotifications}
            onValueChange={(value) => void togglePrivateNotifications(value)}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Low-stock supply alerts"
            detail="Opt in to discreet alerts when any active container reaches your configured threshold. Names and amounts stay private."
            value={lowStockAlerts}
            disabled={busy}
            onValueChange={(value) => void toggleLowStockAlerts(value)}
          />

        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Send test notification" disabled={busy} style={styles.dataButton} onPress={() => void testNotification()}>
          <Text style={styles.dataButtonText}>SEND TEST NOTIFICATION</Text>
        </Pressable>
        <Text style={styles.detail}>Schedules one private test alert in 8 seconds. Does not enable recurring reminders.</Text>

        <Text style={styles.sectionLabel}>YOUR DATA</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data controls</Text>
          <Text style={styles.detail}>Your Pulse data belongs to you. Export a portable JSON copy or permanently delete your account and synced data.</Text>
          <Pressable style={styles.dataButton} disabled={busy} onPress={() => void exportData()}>
            <Text style={styles.dataButtonText}>Export my data</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} disabled={busy} onPress={confirmDeleteAccount}>
            <Text style={styles.deleteButtonText}>DELETE ACCOUNT & DATA</Text>
          </Pressable>
        </View>

        <View style={styles.brandFooter}><PulseBrand compact /></View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutText}>Pulse 2.0</Text>
          <Text style={styles.aboutText}>Science By Hugs</Text>
        </View>

        <Pressable style={styles.signOut} onPress={() => void signOut()}><Text style={styles.signOutText}>Sign out</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({ title, detail, value, disabled, onValueChange }: {
  title: string;
  detail: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onValueChange} trackColor={{ true: colors.accentSoft }} />
    </View>
  );
}

const styles = StyleSheet.create({
  brandFooter: { marginTop: spacing.lg, marginBottom: spacing.sm },
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: layout.pageBottom },
  shieldCard: { backgroundColor: 'transparent', borderRadius: 0, padding: layout.cardInset, borderWidth: 0, borderColor: 'transparent', marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, },
  shieldTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  shieldEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  shieldTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 4 },
  shieldGrid: { flexDirection: 'row', gap: 7, marginTop: spacing.md },
  shieldSignal: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, paddingHorizontal: 5 },
  shieldDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.subtle, marginBottom: 6 },
  shieldDotActive: { backgroundColor: colors.success },
  shieldSignalText: { color: colors.subtle, fontSize: 7, fontWeight: '700', letterSpacing: .7, textAlign: 'center' },
  shieldSignalTextActive: { color: colors.text },
  profileEditor: { backgroundColor: 'transparent', borderRadius: 0, padding: spacing.md, borderWidth: 0, borderColor: 'transparent', marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, },
  profileInput: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, backgroundColor: colors.bgElevated, fontSize: 16 },
  profileSaveDisabled: { opacity: .45 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: 'transparent', borderRadius: 0, padding: layout.cardInset, borderWidth: 0, borderColor: 'transparent', marginBottom: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border, },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  sectionLabel: { color: colors.subtle, fontSize: 10, fontWeight: '700', letterSpacing: .4, marginTop: spacing.sm, marginBottom: spacing.sm },
  card: { backgroundColor: 'transparent', borderRadius: 0, padding: layout.cardInset, borderWidth: 0, borderColor: 'transparent', marginBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, },
  label: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: .4 },
  value: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 6, flexShrink: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settingCopy: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  detail: { color: colors.muted, marginTop: 5, lineHeight: 19, fontSize: 13 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  dataButton: { borderWidth: 1, borderColor: colors.accentBorder, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: spacing.md, backgroundColor: colors.accentSoft },
  dataButtonText: { color: colors.accent, fontWeight: '700', letterSpacing: .8 },
  deleteButton: { borderWidth: 1, borderColor: '#6f3030', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: spacing.sm },
  deleteButtonText: { color: '#ff9b9b', fontWeight: '700', letterSpacing: .8 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingHorizontal: 2 },
  aboutText: { color: colors.subtle, fontSize: 11 },
  signOut: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: spacing.xl },
  signOutText: { color: colors.text, fontWeight: '700', letterSpacing: 1 }
});
