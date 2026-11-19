import type { AuthTokens } from '@orgil/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { api, configureAuth, setTokens } from './api';
import { KEYS, prefs, secure } from './storage';

type Status = 'loading' | 'signedOut' | 'locked' | 'signedIn';

interface AuthCtx {
  status: Status;
  signIn: (tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  biometric: { available: boolean; enabled: boolean; label: string };
  setBiometricEnabled: (v: boolean) => Promise<boolean>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

/**
 * Session model:
 *  - access token in memory only; refresh token in the OS keystore (SecureStore)
 *  - refresh tokens rotate on every use (server detects reuse)
 *  - if biometric login is enabled, the stored session is only resumed after a successful
 *    Face ID / fingerprint check on this device
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [bio, setBio] = useState({ available: false, enabled: false, label: 'Face ID' });

  const persist = useCallback(async (t: AuthTokens | null) => {
    if (t) await secure.set(KEYS.refresh, t.refreshToken);
    else await secure.del(KEYS.refresh);
  }, []);

  useEffect(() => {
    configureAuth((t) => {
      void persist(t);
      if (!t) {
        setStatus('signedOut');
        qc.clear();
      }
    });
  }, [persist, qc]);

  const resume = useCallback(async () => {
    const rt = await secure.get(KEYS.refresh);
    if (!rt) return setStatus('signedOut');
    try {
      setTokens({ accessToken: '', refreshToken: rt });
      const t = await api<AuthTokens>('/auth/refresh', { body: { refreshToken: rt }, auth: false });
      setTokens(t);
      await persist(t);
      setStatus('signedIn');
    } catch {
      setTokens(null);
      await persist(null);
      setStatus('signedOut');
    }
  }, [persist]);

  useEffect(() => {
    (async () => {
      let available = false;
      let label = 'Face ID';
      if (Platform.OS !== 'web') {
        available = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? 'Face ID' : 'Хурууны хээ';
      }
      const enabled = available && (await prefs.get(KEYS.biometric)) === '1';
      setBio({ available, enabled, label });
      const hasSession = Boolean(await secure.get(KEYS.refresh));
      if (hasSession && enabled) setStatus('locked');
      else await resume();
    })();
  }, [resume]);

  const unlockWithBiometrics = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Зээло апп-д нэвтрэх', cancelLabel: 'Цуцлах', disableDeviceFallback: false });
    if (!r.success) return false;
    await resume();
    return true;
  }, [resume]);

  const signIn = useCallback(async (t: AuthTokens) => {
    setTokens(t);
    await persist(t);
    setStatus('signedIn');
  }, [persist]);

  const signOut = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* best effort */ }
    setTokens(null);
    await persist(null);
    qc.clear();
    setStatus('signedOut');
  }, [persist, qc]);

  const setBiometricEnabled = useCallback(async (v: boolean) => {
    if (v) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Биометр баталгаажуулалт идэвхжүүлэх' });
      if (!r.success) return false;
    }
    await prefs.set(KEYS.biometric, v ? '1' : '0');
    setBio((b) => ({ ...b, enabled: v }));
    try { await api('/me/settings', { method: 'PATCH', body: { biometricEnabled: v } }); } catch { /* local preference still applies */ }
    return true;
  }, []);

  const value = useMemo(() => ({ status, signIn, signOut, unlockWithBiometrics, biometric: bio, setBiometricEnabled }), [status, signIn, signOut, unlockWithBiometrics, bio, setBiometricEnabled]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
