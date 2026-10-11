import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createChunkedStorage } from './storageAdapter';

export const privateStorage = Platform.OS === 'web' ? AsyncStorage : createChunkedStorage({
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  }),
  removeItem: key => SecureStore.deleteItemAsync(key)
});

// Upgrade existing native sessions without leaving plaintext tokens behind.
export const authStorage = {
  async getItem(key: string) {
    const secured = await privateStorage.getItem(key);
    if (Platform.OS === 'web') return secured;
    if (secured !== null) {
      await AsyncStorage.removeItem(key);
      return secured;
    }
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      await privateStorage.setItem(key, legacy);
      await AsyncStorage.removeItem(key);
    }
    return legacy;
  },
  async setItem(key: string, value: string) {
    await privateStorage.setItem(key, value);
    if (Platform.OS !== 'web') await AsyncStorage.removeItem(key);
  },
  async removeItem(key: string) {
    await privateStorage.removeItem(key);
    if (Platform.OS !== 'web') await AsyncStorage.removeItem(key);
  }
};
