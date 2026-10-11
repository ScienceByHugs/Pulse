import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_KEY = 'pulse.biometric_lock';
const PRIVATE_NOTIFICATIONS_KEY = 'pulse.private_notifications';
const REMINDERS_KEY = 'pulse.reminders_enabled';
const LOW_STOCK_KEY = 'pulse.low_stock_alerts_enabled';

async function getBoolean(key: string, fallback = false) {
  if (Platform.OS === 'web') return fallback;
  try {
    const stored = await SecureStore.getItemAsync(key);
    return stored === null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
}

async function setBoolean(key: string, value: boolean) {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(key, value ? 'true' : 'false');
}

export const getBiometricLockEnabled = () => getBoolean(BIOMETRIC_KEY);
export const setBiometricLockEnabled = (value: boolean) => setBoolean(BIOMETRIC_KEY, value);
export const getPrivateNotifications = () => getBoolean(PRIVATE_NOTIFICATIONS_KEY, true);
export const setPrivateNotifications = (value: boolean) => setBoolean(PRIVATE_NOTIFICATIONS_KEY, value);
export const getRemindersEnabled = () => getBoolean(REMINDERS_KEY);
export const setRemindersEnabled = (value: boolean) => setBoolean(REMINDERS_KEY, value);

export const getLowStockAlertsEnabled = () => getBoolean(LOW_STOCK_KEY);
export const setLowStockAlertsEnabled = (value: boolean) => setBoolean(LOW_STOCK_KEY, value);
