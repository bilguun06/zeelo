import { dec } from '@orgil/financial-engine';
import { formatMNT, type PaymentIntentDto, type PaymentProvider } from '@orgil/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, CreditCard, FlaskConical, Landmark, QrCode, Smartphone } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, Card, ErrorView, haptic, Header, Input, Notice, Screen, Skeleton, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { qk, useLoan } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

type Mode = 'next' | 'payoff' | 'custom';
const ICONS: Record<PaymentProvider, typeof QrCode> = { QPAY: QrCode, SOCIALPAY: Smartphone, BANK_TRANSFER: Landmark, SANDBOX: FlaskConical };

export default function Repay() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const { t } = useI18n();
  const { c } = useTheme();
  const qc = useQueryClient();
  const { data: loan, error: loanError } = useLoan(loanId);
  const providers = useQuery({ queryKey: ['providers'], queryFn: () => api<{ code: PaymentProvider; enabled: boolean; sandbox: boolean }[]>('/payments/providers', { auth: false }) });
  const [mode, setMode] = useState<Mode>('next');
  const [custom, setCustom] = useState('');
  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [intent, setIntent] = useState<PaymentIntentDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const idemKey = useRef<string>('');

  useEffect(() => {
    if (!provider && providers.data) setProvider(providers.data.find((p) => p.enabled)?.code ?? null);
  }, [providers.data, provider]);

  // Poll the intent while waiting (server verifies with the provider; callbacks are never trusted alone).
  useEffect(() => {
    if (!intent || intent.status !== 'PENDING') return;
    const id = setInterval(async () => {
      try {
        const next = await api<PaymentIntentDto>(`/payments/intents/${intent.id}`);
        if (next.status !== intent.status) setIntent(next);
      } catch { /* keep polling */ }
    }, 4000);
    return () => clearInterval(id);
  }, [intent]);

  useEffect(() => {
    if (intent?.status === 'PAID' && intent.repaymentId) {
      haptic.success();
      void qc.invalidateQueries({ queryKey: qk.loan(loanId) });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
      void qc.invalidateQueries({ queryKey: ['loans'] });
      router.replace(`/receipt/${intent.repaymentId}?fresh=1`);
    }
  }, [intent, loanId, qc]);

  const max = loan?.payoffAmount ?? '0';
  const amount = mode === 'next' ? loan?.nextDue?.amount ?? '0' : mode === 'payoff' ? max : custom;
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && dec(amount).gt(0) && dec(amount).lte(dec(max));

  async function create() {
    if (!provider || !valid) return;
    setLoading(true); setError(null);
    idemKey.current ||= `rp-${Crypto.randomUUID()}`; // same key on retry → same intent (no double charge)
    try {
      const i = await api<PaymentIntentDto>('/payments/intents', { body: { loanId, amount: dec(amount).toFixed(2), provider }, headers: { 'Idempotency-Key': idemKey.current } });
      setIntent(i);
    } catch (e) { setError(e); haptic.error(); } finally { setLoading(false); }
  }

  async function sandboxConfirm() {
    if (!intent) return;
    setLoading(true); setError(null);
    try { setIntent(await api<PaymentIntentDto>(`/payments/intents/${intent.id}/sandbox-confirm`, { method: 'POST' })); } catch (e) { setError(e); } finally { setLoading(false); }
  }

  if (loanError) return <Screen><Header title={t('repay.title')} /><ErrorView error={loanError} /></Screen>;
  if (!loan) return <Screen><Header title={t('repay.title')} /><Skeleton className="h-96" /></Screen>;

  if (intent) {
    return (
      <Screen>
        <Header title={t('repay.waiting')} />
        <Card className="items-center">
          <Text variant="caption">{t('repay.amount')}</Text>
          <Text className="mt-1 font-display text-[32px] text-ink dark:text-ink-inverse">{formatMNT(intent.amount)}</Text>
          {intent.qrText && (
            <View className="my-6 rounded-[22px] bg-white p-4"><QRCode value={intent.qrText} size={200} color="#14161F" /></View>
          )}
          <Text variant="caption" className="text-center">{t('repay.scanQr')}</Text>
          {intent.deeplinks.length > 0 && (
            <View className="mt-4 w-full flex-row flex-wrap justify-center gap-2">
              {intent.deeplinks.slice(0, 8).map((d) => (
                <Pressable key={d.name} onPress={() => void Linking.openURL(d.link)} className="rounded-2xl bg-surface-alt px-3 py-2 dark:bg-surface-altdark"><Text className="text-[12px] text-ink dark:text-ink-inverse">{d.name}</Text></Pressable>
              ))}
            </View>
          )}
        </Card>
        {intent.sandbox && (
          <View className="mt-4">
            <Notice>{t('repay.sandboxNote')}</Notice>
            <Button title={t('repay.sandboxPay')} variant="mint" loading={loading} onPress={sandboxConfirm} className="mt-4" icon={<FlaskConical size={18} color="#14161F" />} />
          </View>
        )}
        {['FAILED', 'EXPIRED'].includes(intent.status) && <ErrorView error={new Error(t(`common.error`))} />}
        {error ? <ErrorView error={error} /> : null}
        <Button title={t('repay.checkStatus')} variant="outline" className="mt-3" onPress={async () => setIntent(await api<PaymentIntentDto>(`/payments/intents/${intent.id}`))} />
      </Screen>
    );
  }

  const options: { mode: Mode; label: string; value?: string }[] = [
    ...(loan.nextDue ? [{ mode: 'next' as const, label: t('repay.nextInstallment'), value: loan.nextDue.amount }] : []),
    { mode: 'payoff', label: t('repay.payoff'), value: loan.payoffAmount },
    { mode: 'custom', label: t('repay.custom') },
  ];

  return (
    <Screen>
      <Header title={t('repay.title')} subtitle={loan.loanNo} />
      <Text variant="label" className="mb-2">{t('repay.amount')}</Text>
      {options.map((o) => (
        <Card key={o.mode} onPress={() => setMode(o.mode)} className={`mb-3 flex-row items-center border-2 ${mode === o.mode ? 'border-brand' : 'border-transparent'}`}>
          <View className="flex-1"><Text variant="bodyStrong">{o.label}</Text>{o.value && <Text className="mt-0.5 font-display-bold text-[18px] text-ink dark:text-ink-inverse">{formatMNT(o.value)}</Text>}</View>
          {mode === o.mode && <CheckCircle2 size={22} color={c.primary} />}
        </Card>
      ))}
      {mode === 'custom' && <Input keyboardType="decimal-pad" placeholder="0" value={custom} onChangeText={(v) => setCustom(v.replace(/[^\d.]/g, ''))} hint={t('repay.maxAmount', { v: formatMNT(max) })} error={custom && !valid ? t('repay.invalidAmount') : undefined} />}

      <Text variant="label" className="mb-2 mt-4">{t('repay.method')}</Text>
      {providers.data?.map((p) => {
        const Icon = ICONS[p.code] ?? CreditCard;
        return (
          <Card key={p.code} onPress={p.enabled ? () => setProvider(p.code) : undefined} className={`mb-3 flex-row items-center gap-4 border-2 ${provider === p.code ? 'border-brand' : 'border-transparent'} ${p.enabled ? '' : 'opacity-50'}`}>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-surface-alt dark:bg-surface-altdark"><Icon size={20} color={c.primary} /></View>
            <View className="flex-1">
              <Text variant="bodyStrong">{t(`repay.providers.${p.code}` as never)}</Text>
              <Text variant="caption" className="text-[12px]">{p.enabled ? (p.sandbox ? t('common.sandbox') : '') : t('repay.providerUnavailable')}</Text>
            </View>
            {provider === p.code && <CheckCircle2 size={22} color={c.primary} />}
          </Card>
        );
      })}
      {error ? <ErrorView error={error} /> : null}
      <Button title={`${t('repay.continue')} · ${valid ? formatMNT(dec(amount).toFixed(2)) : ''}`} disabled={!valid || !provider} loading={loading} onPress={create} className="mt-3" />
    </Screen>
  );
}
