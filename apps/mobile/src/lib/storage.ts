import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Secrets (refresh token) go to the OS keychain/keystore via SecureStore.
 * On web (development preview only) SecureStore is unavailable, so we fall back to sessionStorage.
 */
export const secure = {
  async get(key: string) {
    if (Platform.OS === 'web') return globalThis.sessionStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') return globalThis.sessionStorage?.setItem(key, value);
    return SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async del(key: string) {
    if (Platform.OS === 'web') return globalThis.sessionStorage?.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};

/** Non-sensitive preferences. */
export const prefs = {
  get: (key: string) => AsyncStorage.getItem(key).catch(() => null),
  set: (key: string, value: string) => AsyncStorage.setItem(key, value).catch(() => undefined),
};

export const KEYS = {
  refresh: 'orgil.refresh',
  biometric: 'orgil.biometric',
  onboarded: 'orgil.onboarded',
  language: 'orgil.language',
  theme: 'orgil.theme',
} as const;
