import { useWindowDimensions } from 'react-native';
import { reminderHealthText } from '@/domain/reminderHealth';
import { getReminderHealth } from '@/lib/reminders';
import { RetryNotice } from '@/components/RetryNotice';
import { Linking } from 'react-native';
import { FormSheet } from '@/components/FormSheet';
import * as ImagePicker from 'expo-image-picker';
import {
  getProfilePhotoUrl,
  uploadProfilePhoto,
  removeProfilePhoto,
} from '@/services/profilePhoto';
import { PageHeader } from '@/components/PageHeader';
import { isValidEmail } from '@/domain/validation';
import { PulseBrand } from '@/components/PulseBrand';
import { OrbitalBackground } from '@/components/OrbitalBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, layout, radius, spacing, typography } from '@/theme';
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
} from '@/lib/privacy';
import {
  disableReminders,
  clearPendingReminders,
  enableReminders,
  setReminderPrivacy,
  ReminderPrivacyUpdateError,
  sendTestNotification,
} from '@/lib/reminders';
import { listTodayItems } from '@/services/pulse';
import { clearLowStockAlertState, notifyLowStock } from '@/lib/lowStock';
import { requestReminderPermission } from '@/lib/reminders';
import {
  AccountDeviceCleanupError,
  deletePulseAccount,
  exportPulseData,
} from '@/services/account';

export default function YouScreen() {
  const { fontScale } = useWindowDimensions();
  const router = useRouter();
  const { session } = useAuth();
  const [biometricLock, setBiometricLock] = useState(false);
  const [privateNotifications, setPrivateNotificationsState] = useState(true);
  const [reminders, setReminders] = useState(false);
  const [lowStockAlerts, setLowStockAlerts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const healthRequest = useRef(false);
  const [notificationHealth, setNotificationHealth] = useState<Awaited<
    ReturnType<typeof getReminderHealth>
  > | null>(null);
  const [healthError, setHealthError] = useState('');
  async function refreshNotificationHealth() {
    if (healthRequest.current) return;
    healthRequest.current = true;
    setRefreshingHealth(true);
    setHealthError('');
    try {
      setNotificationHealth(await getReminderHealth());
    } catch {
      setHealthError(
        'Could not read notification status. Retry while Pulse is open.',
      );
    } finally {
      healthRequest.current = false;
      setRefreshingHealth(false);
    }
  }
  const [displayName, setDisplayName] = useState(() =>
    String(session?.user.user_metadata?.full_name ?? ''),
  );
  const [savedName, setSavedName] = useState(() =>
    String(session?.user.user_metadata?.full_name ?? ''),
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [contactPhone, setContactPhone] = useState(() =>
    String(session?.user.user_metadata?.contact_phone ?? ''),
  );
  const [savedPhone, setSavedPhone] = useState(() =>
    String(session?.user.user_metadata?.contact_phone ?? ''),
  );
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountSheet, setAccountSheet] = useState<
    'profile' | 'security' | null
  >(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const initials = (savedName || session?.user.email?.split('@')[0] || 'P')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const joined = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : null;

  function closeSheet() {
    if (savingProfile || photoBusy || accountBusy) return;
    setAccountSheet(null);
    setNewPassword('');
    setConfirmPassword('');
    setNewEmail('');
  }

  async function choosePhoto() {
    if (photoBusy || savingProfile || accountBusy || busy) return;
    setPhotoBusy(true);
    setPhotoError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) throw new Error('Choose a different photo.');
      const url = await uploadProfilePhoto(
        asset.uri,
        asset.width,
        asset.height,
      );
      setPhotoUrl(url);
      setPhotoFailed(false);
    } catch (error) {
      Alert.alert(
        'Could not update photo',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function confirmRemovePhoto() {
    if (photoBusy || savingProfile || accountBusy || busy) return;
    Alert.alert('Remove profile photo?', 'Your initials will appear instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove photo',
        style: 'destructive',
        onPress: () => {
          setPhotoBusy(true);
          void removeProfilePhoto()
            .then(() => {
              setPhotoUrl(null);
              setPhotoFailed(false);
              setPhotoError('');
            })
            .catch((error) =>
              Alert.alert(
                'Could not remove photo',
                error instanceof Error ? error.message : 'Please try again.',
              ),
            )
            .finally(() => setPhotoBusy(false));
        },
      },
    ]);
  }

  function openProfile() {
    setDisplayName(savedName);
    setContactPhone(savedPhone);
    setAccountSheet('profile');
  }

  const load = useCallback(async () => {
    setLoadError('');
    void refreshNotificationHealth();
    const [lock, privateMode, reminderMode, lowStockMode] = await Promise.all([
      getBiometricLockEnabled(),
      getPrivateNotifications(),
      getRemindersEnabled(),
      getLowStockAlertsEnabled(),
    ]);
    setBiometricLock(lock);
    setPrivateNotificationsState(privateMode);
    setReminders(reminderMode);
    setLowStockAlerts(lowStockMode);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    const currentName = String(user?.user_metadata?.full_name ?? '');
    setDisplayName(currentName);
    setSavedName(currentName);
    const phone = String(user?.user_metadata?.contact_phone ?? '');
    setContactPhone(phone);
    setSavedPhone(phone);
    if (user) {
      try {
        setPhotoUrl(await getProfilePhotoUrl(user.id));
        setPhotoFailed(false);
        setPhotoError('');
      } catch {
        setPhotoError(
          'Photo unavailable. Check your connection and try again.',
        );
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load().catch(() =>
        setLoadError(
          'Could not refresh your account. Your saved profile remains visible. Check your connection and retry.',
        ),
      );
      // Keep private photo links fresh while this screen remains open.
      const timer = setInterval(() => {
        if (session?.user.id)
          void getProfilePhotoUrl(session.user.id)
            .then((url) => {
              setPhotoUrl(url);
              setPhotoFailed(false);
            })
            .catch(() => undefined);
      }, 240000);
      return () => clearInterval(timer);
    }, [load, session?.user.id]),
  );

  async function saveProfile() {
    if (savingProfile || photoBusy || accountBusy || busy) return;
    const name = displayName.trim();
    if (!name || name.length > 80)
      return Alert.alert(
        'Check your name',
        'Enter a name of up to 80 characters.',
      );
    const phone = contactPhone.trim();
    if (phone.length > 30 || (phone && !/^[+0-9().\-\s]{7,30}$/.test(phone)))
      return Alert.alert(
        'Check your phone',
        'Enter a valid contact phone number, or leave it blank.',
      );
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: name,
          first_name: name.split(/\s+/)[0],
          contact_phone: phone,
        },
      });
      if (error) throw error;
      setSavedName(name);
      setSavedPhone(phone);
      setAccountSheet(null);
    } catch (error) {
      Alert.alert(
        'Could not save profile',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function requestEmailChange() {
    const address = newEmail.trim().toLowerCase();
    if (
      !isValidEmail(address) ||
      address === session?.user.email?.toLowerCase()
    ) {
      return Alert.alert(
        'Check new email',
        'Enter a different, valid email address.',
      );
    }
    if (accountBusy) return;
    setAccountBusy(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: address },
        { emailRedirectTo: 'pulse://auth/callback' },
      );
      if (error) throw error;
      setNewEmail('');
      Alert.alert(
        'Check your inbox',
        'Your email change request was submitted. Follow the verification instructions in the email. Your sign-in email may not change until confirmation is complete.',
      );
    } catch (error) {
      Alert.alert(
        'Could not change email',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setAccountBusy(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 8)
      return Alert.alert(
        'Check password',
        'Use a password with at least 8 characters.',
      );
    if (newPassword !== confirmPassword)
      return Alert.alert(
        'Passwords differ',
        'Both password fields must match.',
      );
    if (accountBusy) return;
    setAccountBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your new password has been saved.');
    } catch (error) {
      Alert.alert(
        'Could not update password',
        error instanceof Error
          ? error.message
          : 'You may need to sign in again.',
      );
    } finally {
      setAccountBusy(false);
    }
  }

  async function toggleLock(value: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (!value) {
        await setBiometricLockEnabled(false);
        setBiometricLock(false);
        return;
      }

      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled =
        hardware && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) {
        Alert.alert(
          'Biometrics unavailable',
          'Set up Face ID, Touch ID, or device biometrics first.',
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable Pulse privacy lock',
        disableDeviceFallback: false,
      });
      if (!result.success) return;

      await setBiometricLockEnabled(true);
      setBiometricLock(true);
    } catch (error) {
      Alert.alert(
        'Could not update privacy lock',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleReminders(value: boolean) {
    if (busy) return;
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
      if (!enabled)
        Alert.alert(
          'Notifications are off',
          'Enable notifications for Pulse in device settings to use reminders.',
        );
    } catch (error) {
      Alert.alert(
        'Could not update reminders',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      try {
        setReminders(await getRemindersEnabled());
      } catch {
        setHealthError(
          'Could not read your saved reminder preference. Refresh the status before changing it again.',
        );
      }
      await refreshNotificationHealth();
      setBusy(false);
    }
  }

  async function testNotification() {
    if (busy) return;
    setBusy(true);
    try {
      const scheduled = await sendTestNotification();
      Alert.alert(
        scheduled ? 'Test scheduled' : 'Notifications are disabled',
        scheduled
          ? 'A test notification is scheduled for 8 seconds from now. Lock the phone or leave Pulse to check the banner. Focus or Do Not Disturb settings may silence it.'
          : 'Enable notifications for Pulse in device settings, then try again.',
      );
    } catch (error) {
      Alert.alert(
        'Notification test failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      await refreshNotificationHealth();
      setBusy(false);
    }
  }

  async function toggleLowStockAlerts(value: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (value && !(await requestReminderPermission())) {
        Alert.alert(
          'Notifications are off',
          'Enable notifications for Pulse in device settings.',
        );
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
      Alert.alert(
        'Could not update supply alerts',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      await refreshNotificationHealth();
      setBusy(false);
    }
  }

  async function togglePrivateNotifications(value: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await setReminderPrivacy(value, () => listTodayItems());
      setPrivateNotificationsState(value);
    } catch (error) {
      const saved =
        error instanceof ReminderPrivacyUpdateError && error.preferenceSaved;
      try {
        setPrivateNotificationsState(await getPrivateNotifications());
      } catch {
        if (saved) setPrivateNotificationsState(value);
      }
      Alert.alert(
        saved
          ? 'Notification text saved · reminders need attention'
          : 'Could not save notification privacy',
        saved
          ? error instanceof ReminderPrivacyUpdateError && error.pendingCleared
            ? 'Your preference was saved and old pending alerts were cleared, but your routine could not refresh. Reconnect, then turn protocol reminders off and on to restore them.'
            : 'Your preference was saved, but scheduled reminders could not be fully refreshed. Reconnect, then turn protocol reminders off and on to restore them.'
          : error instanceof Error
            ? error.message
            : 'Please try again.',
      );
    } finally {
      await refreshNotificationHealth();
      setBusy(false);
    }
  }

  async function exportData() {
    if (busy || photoBusy || savingProfile || accountBusy) return;
    setBusy(true);
    try {
      await exportPulseData();
    } catch (error) {
      Alert.alert(
        'Could not export data',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteAccount() {
    if (busy || photoBusy || savingProfile || accountBusy) return;
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
                Alert.alert(
                  error instanceof AccountDeviceCleanupError
                    ? 'Account deleted · device cleanup incomplete'
                    : 'Could not delete account',
                  error instanceof Error ? error.message : 'Unknown error',
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }

  async function signOut() {
    if (busy || photoBusy || savingProfile || accountBusy) return;
    setBusy(true);
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      try {
        await clearPendingReminders();
      } catch {
        Alert.alert(
          'Signed out · notification cleanup incomplete',
          'Your account is signed out, but some device notifications could not be cleared. Disable Pulse notifications in device settings if you need to stop them immediately.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Could not sign out',
        error instanceof Error
          ? error.message
          : 'Check your connection and try again.',
      );
    } finally {
      setSigningOut(false);
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <OrbitalBackground />
      <ScrollView
        contentContainerStyle={[
          styles.page,
          {
            paddingBottom: layout.pageBottom + Math.max(0, fontScale - 1) * 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PulseMenu />
        <PageHeader
          title="Your space"
          description="Make Pulse feel like you."
        />
        {!!loadError && (
          <RetryNotice
            message={loadError}
            onRetry={() =>
              void load().catch(() =>
                setLoadError(
                  'Could not refresh your account. Check your connection and retry.',
                ),
              )
            }
          />
        )}
        <View style={styles.profileCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              photoUrl ? 'Change profile photo' : 'Add profile photo'
            }
            disabled={photoBusy || busy || savingProfile || accountBusy}
            onPress={() => void choosePhoto()}
            style={styles.avatar}
          >
            {photoUrl && !photoFailed ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.avatarImage}
                onError={() => {
                  setPhotoFailed(true);
                  setPhotoError(
                    'Photo unavailable. Check your connection or choose a photo again.',
                  );
                }}
              />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </Pressable>
          <Text style={styles.profileName}>
            {savedName || 'Your Pulse profile'}
          </Text>
          <Text style={styles.profileEmail} selectable>
            {session?.user.email}
          </Text>
          {joined && (
            <Text style={styles.detail}>With Pulse since {joined}</Text>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={busy || photoBusy || savingProfile || accountBusy}
            onPress={openProfile}
            style={styles.dataButton}
          >
            <Text style={styles.dataButtonText}>Edit profile</Text>
          </Pressable>
          {photoBusy && (
            <Text accessibilityLiveRegion="polite" style={styles.detail}>
              Updating photo…
            </Text>
          )}
          {!!photoError && (
            <Text accessibilityLiveRegion="polite" style={styles.detail}>
              {photoError}
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.dataButton}
          onPress={() => router.push('/legal')}
        >
          <Text style={{ ...typography.body, color: colors.accent }}>
            Legal & Privacy →
          </Text>
        </Pressable>
        <Text style={styles.sectionLabel}>Privacy & reminders</Text>
        <View style={styles.card}>
          <SettingRow
            title="Biometric app lock"
            detail={
              Platform.OS === 'web'
                ? 'Available in the iPhone and Android app.'
                : 'Require Face ID, Touch ID, or device biometrics when Pulse opens.'
            }
            value={biometricLock}
            disabled={busy || Platform.OS === 'web'}
            onValueChange={(value) => void toggleLock(value)}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Protocol reminders"
            detail={
              Platform.OS === 'web'
                ? 'Local reminders are available in the iPhone and Android app.'
                : 'Schedule local reminders from your active protocol.'
            }
            value={reminders}
            disabled={busy || Platform.OS === 'web'}
            onValueChange={(value) => void toggleReminders(value)}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Private notification text"
            detail="Hide item names and amounts from notification previews."
            value={privateNotifications}
            disabled={busy || Platform.OS === 'web'}
            onValueChange={(value) => void togglePrivateNotifications(value)}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Low-stock supply alerts"
            detail="Opt in to discreet alerts when any active container reaches your configured threshold. Names and amounts stay private."
            value={lowStockAlerts}
            disabled={busy || Platform.OS === 'web'}
            onValueChange={(value) => void toggleLowStockAlerts(value)}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send test notification"
          disabled={busy || Platform.OS === 'web'}
          style={styles.dataButton}
          onPress={() => void testNotification()}
        >
          <Text style={styles.dataButtonText}>Send test notification</Text>
        </Pressable>
        <Text style={styles.detail}>
          Schedules one private test alert in 8 seconds. Does not enable
          recurring reminders.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reminder health</Text>
          {notificationHealth && (
            <>
              <Text style={styles.detail}>
                {
                  reminderHealthText(
                    notificationHealth.enabled,
                    notificationHealth.permission,
                    notificationHealth.count,
                    notificationHealth.web,
                  ).title
                }
              </Text>
              <Text style={styles.detail}>
                {
                  reminderHealthText(
                    notificationHealth.enabled,
                    notificationHealth.permission,
                    notificationHealth.count,
                    notificationHealth.web,
                  ).body
                }
              </Text>
            </>
          )}
          {!!healthError && (
            <RetryNotice
              message={healthError}
              onRetry={() => void refreshNotificationHealth()}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: refreshingHealth }}
            disabled={refreshingHealth || busy}
            style={styles.dataButton}
            onPress={() => void refreshNotificationHealth()}
          >
            <Text style={styles.dataButtonText}>
              {refreshingHealth
                ? 'Checking reminder status…'
                : 'Refresh reminder status'}
            </Text>
          </Pressable>
          {Platform.OS !== 'web' && (
            <Pressable
              accessibilityRole="button"
              style={styles.dataButton}
              onPress={() =>
                void Linking.openSettings().catch(() =>
                  setHealthError(
                    'Open your device settings manually to review Pulse notifications.',
                  ),
                )
              }
            >
              <Text style={styles.dataButtonText}>Open device settings</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.sectionLabel}>Account</Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy || photoBusy || savingProfile || accountBusy}
          onPress={() => setAccountSheet('security')}
          style={styles.accountRow}
        >
          <View style={styles.settingCopy}>
            <Text style={styles.cardTitle}>Sign-in & security</Text>
            <Text style={styles.detail}>Manage your email and password.</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Text style={styles.sectionLabel}>Your data</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data controls</Text>
          <Text style={styles.detail}>
            Your Pulse data belongs to you. Export a portable JSON copy or
            permanently delete your account and synced data.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.dataButton}
            disabled={busy || photoBusy || savingProfile || accountBusy}
            onPress={() => void exportData()}
          >
            <Text style={styles.dataButtonText}>Export my data</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.deleteButton}
            disabled={busy || photoBusy || savingProfile || accountBusy}
            onPress={confirmDeleteAccount}
          >
            <Text style={styles.deleteButtonText}>Delete account & data</Text>
          </Pressable>
        </View>

        <View style={styles.brandFooter}>
          <PulseBrand compact />
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutText}>Pulse by SBH</Text>
          <Text style={styles.aboutText}>Science By Hugs</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: signingOut }}
          disabled={busy || photoBusy || savingProfile || accountBusy}
          style={styles.signOut}
          onPress={() => void signOut()}
        >
          <Text style={styles.signOutText}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Text>
        </Pressable>
      </ScrollView>
      <FormSheet
        visible={accountSheet !== null}
        contentKey={accountSheet ?? 'closed'}
        label={
          accountSheet === 'profile' ? 'Edit profile' : 'Sign-in & security'
        }
        onClose={closeSheet}
        busy={savingProfile || photoBusy || accountBusy}
      >
        {accountSheet === 'profile' ? (
          <View style={styles.profileEditor}>
            <Text style={styles.cardTitle}>Your profile</Text>
            <View style={styles.sheetAvatar}>
              {photoUrl && !photoFailed ? (
                <Image
                  source={{ uri: photoUrl }}
                  style={styles.avatarImage}
                  onError={() => setPhotoFailed(true)}
                />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
            <View style={styles.photoActions}>
              <Pressable
                accessibilityRole="button"
                disabled={photoBusy || savingProfile}
                style={[
                  styles.dataButton,
                  styles.photoAction,
                  photoBusy && styles.profileSaveDisabled,
                ]}
                onPress={() => void choosePhoto()}
              >
                <Text style={styles.dataButtonText}>
                  {photoBusy
                    ? 'Updating…'
                    : photoUrl
                      ? 'Change photo'
                      : 'Add photo'}
                </Text>
              </Pressable>
              {photoUrl && (
                <Pressable
                  accessibilityRole="button"
                  disabled={photoBusy || savingProfile}
                  style={[styles.dataButton, styles.photoAction]}
                  onPress={confirmRemovePhoto}
                >
                  <Text style={styles.dataButtonText}>Remove photo</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.detail}>
              Your photo is visible only in your account.
            </Text>
            <Text style={styles.detail}>
              Set the name and optional contact number shown in your private
              profile. This phone number is not verified for sign-in or text
              messages.
            </Text>
            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              accessibilityLabel="Display name"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={80}
              style={styles.profileInput}
              placeholder="Your name"
              placeholderTextColor={colors.muted}
              value={displayName}
              onChangeText={setDisplayName}
              editable={!savingProfile && !photoBusy}
            />
            <Text style={styles.fieldLabel}>Contact phone · optional</Text>
            <TextInput
              accessibilityLabel="Contact phone number, optional"
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={30}
              style={styles.profileInput}
              placeholder="Contact phone (optional)"
              placeholderTextColor={colors.muted}
              value={contactPhone}
              onChangeText={setContactPhone}
              editable={!savingProfile && !photoBusy}
            />
            <Pressable
              accessibilityRole="button"
              style={[
                styles.dataButton,
                (savingProfile ||
                  photoBusy ||
                  (displayName.trim() === savedName &&
                    contactPhone.trim() === savedPhone)) &&
                  styles.profileSaveDisabled,
              ]}
              disabled={
                savingProfile ||
                photoBusy ||
                (displayName.trim() === savedName &&
                  contactPhone.trim() === savedPhone)
              }
              onPress={() => void saveProfile()}
            >
              <Text style={styles.dataButtonText}>
                {savingProfile ? 'Saving…' : 'Save profile'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.profileEditor}>
            <Text style={styles.cardTitle}>Change email</Text>
            <Text style={styles.detail}>
              Current sign-in email: {session?.user.email ?? '—'}. A new address
              may require confirmation through email.
            </Text>
            <Text style={styles.fieldLabel}>New email address</Text>
            <TextInput
              accessibilityLabel="New account email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              style={styles.profileInput}
              placeholder="New email address"
              placeholderTextColor={colors.muted}
              value={newEmail}
              onChangeText={setNewEmail}
              editable={!accountBusy}
            />
            <Pressable
              accessibilityRole="button"
              disabled={accountBusy || !newEmail.trim()}
              style={[
                styles.dataButton,
                (accountBusy || !newEmail.trim()) && styles.profileSaveDisabled,
              ]}
              onPress={() => void requestEmailChange()}
            >
              <Text style={styles.dataButtonText}>Request email change</Text>
            </Pressable>
            <View style={styles.divider} />
            <Text style={styles.cardTitle}>Change password</Text>
            <Text style={styles.detail}>
              Choose a new password with at least 8 characters. You may be asked
              to verify your identity.
            </Text>
            <Text style={styles.fieldLabel}>New password</Text>
            <TextInput
              accessibilityLabel="New account password"
              secureTextEntry
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.profileInput}
              placeholder="New password"
              placeholderTextColor={colors.muted}
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!accountBusy}
            />
            <Text style={styles.fieldLabel}>Confirm new password</Text>
            <TextInput
              accessibilityLabel="Confirm account password"
              secureTextEntry
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.profileInput}
              placeholder="Confirm new password"
              placeholderTextColor={colors.muted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!accountBusy}
            />
            <Pressable
              accessibilityRole="button"
              disabled={accountBusy || !newPassword || !confirmPassword}
              style={[
                styles.dataButton,
                (accountBusy || !newPassword || !confirmPassword) &&
                  styles.profileSaveDisabled,
              ]}
              onPress={() => void changePassword()}
            >
              <Text style={styles.dataButtonText}>Update password</Text>
            </Pressable>
          </View>
        )}
      </FormSheet>
    </SafeAreaView>
  );
}

function SettingRow({
  title,
  detail,
  value,
  disabled,
  onValueChange,
}: {
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
      <Switch
        accessibilityLabel={title}
        accessibilityHint={detail}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accentSoft }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheetAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  avatarImage: { width: 86, height: 86, borderRadius: 43 },
  profileName: {
    ...typography.sectionTitle,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  profileEmail: {
    ...typography.detail,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.text,
    marginTop: spacing.md,
  },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoAction: { paddingHorizontal: spacing.md, minHeight: 44 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  chevron: { color: colors.muted, fontSize: 26 },
  brandFooter: { marginTop: spacing.lg, marginBottom: spacing.sm },
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: layout.pageInset, paddingBottom: layout.pageBottom },
  profileEditor: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: spacing.md,
    borderWidth: 0,
    borderColor: 'transparent',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileInput: {
    ...typography.input,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    backgroundColor: colors.bgElevated,
  },
  profileSaveDisabled: { opacity: 0.45 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontSize: 28, fontWeight: '700' },
  sectionLabel: {
    ...typography.eyebrow,
    color: colors.subtle,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: layout.cardInset,
    borderWidth: 0,
    borderColor: 'transparent',
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settingCopy: { flex: 1, minWidth: 0 },
  cardTitle: { ...typography.cardTitle, color: colors.text },
  detail: { ...typography.detail, color: colors.muted, marginTop: 8 },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  dataButton: {
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.accentSoft,
  },
  dataButtonText: { ...typography.button, color: colors.accent },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#6f3030',
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  deleteButtonText: { ...typography.button, color: '#ff9b9b' },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingHorizontal: 2,
  },
  aboutText: { ...typography.caption, color: colors.subtle },
  signOut: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  signOutText: { ...typography.button, color: colors.text },
});
