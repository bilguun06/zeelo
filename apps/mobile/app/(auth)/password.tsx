import type { AuthTokens } from '@orgil/shared';
import { newPasswordSchema } from '@orgil/validation';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Fingerprint } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import { AuthShell } from '@/components/auth-shell';
import { Button, ErrorView, haptic, Input, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText, useI18n } from '@/lib/i18n';

const RULES = [
  { key: 'len', test: (p: string) => p.length >= 8, mn: '8+ тэмдэгт', en: '8+ characters' },
  { key: 'letter', test: (p: string) => /[A-Za-z]/.test(p), mn: 'Латин үсэг', en: 'A letter' },
  { key: 'digit', test: (p: string) => /\d/.test(p), mn: 'Тоо', en: 'A number' },
];

export default function CreatePassword() {
  const { t, lang } = useI18n();
  const errText = useErrorText();
  const { signIn, biometric, setBiometricEnabled } = useAuth();
  const { token, purpose } = useLocalSearchParams<{ token: string; purpose: 'REGISTER' | 'RESET_PASSWORD' }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [askBio, setAskBio] = useState(false);

  async function submit() {
    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], errText(i.message)]))); haptic.error(); return; }
    setErrors({}); setError(null); setLoading(true);
    try {
      if (purpose === 'REGISTER') {
        const tokens = await api<AuthTokens>('/auth/register', { body: { verificationToken: token, password, deviceName: `${Platform.OS} app` }, auth: false });
        await signIn(tokens);
        haptic.success();
        if (biometric.available) setAskBio(true);
        else router.replace('/(tabs)');
      } else {
        await api('/auth/password/reset', { body: { verificationToken: token, password }, auth: false });
        haptic.success();
        router.replace('/(auth)/login');
      }
    } catch (e) { haptic.error(); setError(e); } finally { setLoading(false); }
  }

  const finishBio = async (enable: boolean) => {
    if (enable) await setBiometricEnabled(true);
    setAskBio(false);
    router.replace('/(tabs)');
  };

  return (
    <AuthShell title={purpose === 'REGISTER' ? t('auth.createPassword') : t('auth.resetPassword')} subtitle={t('auth.createPasswordSubtitle')}>
      <Input label={t('auth.password')} secureTextEntry value={password} onChangeText={setPassword} error={errors.password} textContentType="newPassword" autoFocus />
      <View className="-mt-1 mb-4 flex-row flex-wrap gap-2">
        {RULES.map((r) => {
          const ok = r.test(password);
          return (
            <View key={r.key} className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${ok ? 'bg-mint-soft dark:bg-mint/15' : 'bg-surface-alt dark:bg-surface-altdark'}`}>
              <Check size={12} color={ok ? '#14936B' : '#8C8481'} />
              <Text className={`text-[12px] ${ok ? 'text-emerald-700 dark:text-mint' : 'text-ink-muted'}`}>{lang === 'mn' ? r.mn : r.en}</Text>
            </View>
          );
        })}
      </View>
      <Input label={t('auth.passwordConfirm')} secureTextEntry value={confirm} onChangeText={setConfirm} error={errors.confirm} textContentType="newPassword" />
      {error ? <ErrorView error={error} /> : null}
      <Button title={t('common.continue')} onPress={submit} loading={loading} className="mt-2" />

      <Modal visible={askBio} transparent animationType="fade">
        <View className="flex-1 items-center justify-end bg-navy/60 p-4">
          <View className="w-full rounded-[28px] bg-surface p-6 dark:bg-surface-dark">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft dark:bg-brand/20"><Fingerprint size={28} color="#FF5533" /></View>
            <Text variant="h2">{t('auth.biometricEnable')}</Text>
            <Text variant="body" className="mt-2 text-ink-muted">{t('auth.biometricEnableBody')}</Text>
            <Button title={t('auth.enable')} onPress={() => finishBio(true)} className="mt-6" />
            <Button title={t('auth.later')} variant="ghost" onPress={() => finishBio(false)} className="mt-2" />
          </View>
        </View>
      </Modal>
    </AuthShell>
  );
}
