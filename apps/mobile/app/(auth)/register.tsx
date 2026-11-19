import { phoneSchema } from '@orgil/validation';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { AuthShell } from '@/components/auth-shell';
import { Button, ErrorView, haptic, Input, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useErrorText, useI18n } from '@/lib/i18n';

/** Shared by registration and password reset: request an OTP for a phone number. */
export function PhoneStep({ purpose }: { purpose: 'REGISTER' | 'RESET_PASSWORD' }) {
  const { t } = useI18n();
  const errText = useErrorText();
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) { setFieldError(errText(parsed.error.issues[0].message)); haptic.error(); return; }
    setFieldError(undefined); setError(null); setLoading(true);
    try {
      const r = await api<{ devCode?: string; cooldownSeconds: number }>('/auth/otp/request', { body: { phone: parsed.data, purpose }, auth: false });
      router.push({ pathname: '/(auth)/otp', params: { phone: parsed.data, purpose, devCode: r.devCode ?? '', cooldown: String(r.cooldownSeconds) } });
    } catch (e) { haptic.error(); setError(e); } finally { setLoading(false); }
  }

  const reg = purpose === 'REGISTER';
  return (
    <AuthShell
      title={reg ? t('auth.registerTitle') : t('auth.forgotTitle')}
      subtitle={reg ? t('auth.registerSubtitle') : t('auth.forgotSubtitle')}
      footer={reg ? (
        <>
          <Text variant="caption" className="mt-6 text-center text-[12px]">{t('auth.termsNotice')}</Text>
          <Link href="/(auth)/login" asChild><Pressable className="mt-4 items-center"><Text className="font-inter-semibold text-[14px] text-brand">{t('auth.haveAccount')}</Text></Pressable></Link>
        </>
      ) : undefined}
    >
      <Input label={t('auth.phone')} placeholder={t('auth.phonePlaceholder')} keyboardType="phone-pad" maxLength={8} value={phone} onChangeText={setPhone} error={fieldError} autoFocus />
      {error ? <ErrorView error={error} /> : null}
      <Button title={t('auth.sendCode')} onPress={submit} loading={loading} className="mt-2" />
    </AuthShell>
  );
}

export default function Register() {
  return <PhoneStep purpose="REGISTER" />;
}
