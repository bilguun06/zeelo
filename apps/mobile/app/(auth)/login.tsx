import type { AuthTokens } from '@orgil/shared';
import { loginSchema } from '@orgil/validation';
import { Link, router } from 'expo-router';
import { Eye, EyeOff, Fingerprint, ScanFace } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { AuthShell } from '@/components/auth-shell';
import { Button, ErrorView, haptic, Input, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText, useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const { t } = useI18n();
  const errText = useErrorText();
  const { signIn, status, unlockWithBiometrics, biometric } = useAuth();
  const { iconMuted } = useTheme();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const unlock = async () => {
    if (await unlockWithBiometrics()) router.replace('/(tabs)');
  };
  useEffect(() => {
    if (status === 'locked') void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function submit() {
    setError(null);
    const parsed = loginSchema.safeParse({ phone, password });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], errText(i.message)])));
      haptic.error();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const tokens = await api<AuthTokens>('/auth/login', { body: { ...parsed.data, deviceName: `${Platform.OS} app` }, auth: false });
      await signIn(tokens);
      haptic.success();
      router.replace('/(tabs)');
    } catch (e) {
      haptic.error();
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  const BioIcon = biometric.label === 'Face ID' ? ScanFace : Fingerprint;

  return (
    <AuthShell
      title={status === 'locked' ? t('auth.welcome') : t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      back={false}
      footer={<Link href="/(auth)/register" asChild><Pressable className="mt-6 items-center"><Text className="font-inter-semibold text-[14px] text-brand">{t('auth.noAccount')}</Text></Pressable></Link>}
    >
      {status === 'locked' && biometric.enabled && (
        <Pressable onPress={unlock} className="mb-6 flex-row items-center gap-3 rounded-[22px] bg-navy p-5 active:opacity-90">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><BioIcon size={26} color="#42D6A4" /></View>
          <View className="flex-1"><Text className="font-inter-semibold text-[15px] text-white">{t('auth.biometricUse')}</Text><Text className="text-[12px] text-white/60">{t('auth.biometricPrompt')}</Text></View>
        </Pressable>
      )}
      <Input label={t('auth.phone')} placeholder={t('auth.phonePlaceholder')} keyboardType="phone-pad" maxLength={8} value={phone} onChangeText={setPhone} error={errors.phone} autoComplete="tel" textContentType="telephoneNumber" />
      <Input
        label={t('auth.password')} secureTextEntry={!show} value={password} onChangeText={setPassword} error={errors.password} autoComplete="password" textContentType="password"
        right={<Pressable onPress={() => setShow(!show)} hitSlop={10}>{show ? <EyeOff size={20} color={iconMuted} /> : <Eye size={20} color={iconMuted} />}</Pressable>}
      />
      <Link href="/(auth)/forgot" asChild><Pressable className="mb-6 self-end"><Text className="font-inter-semibold text-[13px] text-brand">{t('auth.forgot')}</Text></Pressable></Link>
      {error ? <ErrorView error={error} /> : null}
      <Button title={t('auth.login')} onPress={submit} loading={loading} />
    </AuthShell>
  );
}
