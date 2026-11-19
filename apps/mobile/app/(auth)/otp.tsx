import { formatPhone } from '@orgil/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AuthShell } from '@/components/auth-shell';
import { Button, ErrorView, haptic, Notice, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export default function Otp() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ phone: string; purpose: 'REGISTER' | 'RESET_PASSWORD'; devCode?: string; cooldown?: string }>();
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(params.devCode);
  const [left, setLeft] = useState(Number(params.cooldown ?? 60));
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  async function verify(value = code) {
    if (value.length !== 6) return;
    setError(null); setLoading(true);
    try {
      const { verificationToken } = await api<{ verificationToken: string }>('/auth/otp/verify', { body: { phone: params.phone, purpose: params.purpose, code: value }, auth: false });
      haptic.success();
      router.replace({ pathname: '/(auth)/password', params: { token: verificationToken, purpose: params.purpose } });
    } catch (e) {
      haptic.error(); setError(e); setCode('');
    } finally { setLoading(false); }
  }

  async function resend() {
    setError(null);
    try {
      const r = await api<{ devCode?: string; cooldownSeconds: number }>('/auth/otp/request', { body: { phone: params.phone, purpose: params.purpose }, auth: false });
      setDevCode(r.devCode);
      setLeft(r.cooldownSeconds);
    } catch (e) { setError(e); }
  }

  return (
    <AuthShell title={t('auth.otpTitle')} subtitle={t('auth.otpSubtitle', { phone: formatPhone(params.phone ?? '') })}>
      <Pressable onPress={() => input.current?.focus()} className="mb-6 flex-row justify-between">
        {Array.from({ length: 6 }).map((_, i) => {
          const filled = i < code.length;
          const focused = i === code.length;
          return (
            <View key={i} className={`h-16 w-[14%] items-center justify-center rounded-[18px] border-2 bg-surface dark:bg-surface-dark ${focused ? 'border-brand' : filled ? 'border-line dark:border-line-dark' : 'border-transparent'}`}>
              <Text className="font-display text-[26px] text-ink dark:text-ink-inverse">{code[i] ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input} value={code} autoFocus keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete="sms-otp"
        onChangeText={(v) => { const clean = v.replace(/\D/g, ''); setCode(clean); if (clean.length === 6) void verify(clean); }}
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />
      {devCode ? <View className="mb-4"><Notice tone="info">{t('auth.devOtpHint', { code: devCode })}</Notice></View> : null}
      {error ? <ErrorView error={error} /> : null}
      <Button title={t('auth.verify')} onPress={() => verify()} loading={loading} disabled={code.length !== 6} />
      <Pressable disabled={left > 0} onPress={resend} className="mt-5 items-center">
        <Text className={`font-inter-semibold text-[14px] ${left > 0 ? 'text-ink-muted' : 'text-brand'}`}>{left > 0 ? t('auth.resendIn', { s: left }) : t('auth.resend')}</Text>
      </Pressable>
    </AuthShell>
  );
}
