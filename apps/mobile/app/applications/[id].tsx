import { formatDateTime, formatMNT, type ApplicationStatus } from '@orgil/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Clock, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Button, Card, ErrorView, Header, Input, Notice, Row, Screen, Skeleton, StatusPill, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { qk, useApplication } from '@/lib/queries';

const FLOW: ApplicationStatus[] = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'DISBURSED', 'COMPLETED'];

export default function ApplicationStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data: a, error, refetch, isRefetching } = useApplication(id);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); await refetch(); await qc.invalidateQueries({ queryKey: qk.dashboard }); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const cancel = () => {
    const run = () => act(() => api(`/applications/${id}/cancel`, { method: 'POST' }));
    if (Platform.OS === 'web') return void run();
    Alert.alert(t('status.cancelApplication'), t('status.cancelConfirm'), [{ text: t('common.no'), style: 'cancel' }, { text: t('common.yes'), style: 'destructive', onPress: () => void run() }]);
  };

  if (error) return <Screen><Header title={t('apply.title')} /><ErrorView error={error} onRetry={refetch} /></Screen>;
  if (!a) return <Screen><Header title={t('apply.title')} /><Skeleton className="h-96" /></Screen>;

  const terminalBad = a.status === 'REJECTED' || a.status === 'CANCELLED';
  const reached = (s: ApplicationStatus) => a.history.some((h) => h.status === s) || a.status === s;
  const flow = terminalBad ? [...FLOW.slice(0, 2), a.status] : a.status === 'INFO_REQUESTED' ? ['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'DISBURSED'] as ApplicationStatus[] : FLOW;

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Header title={a.applicationNo} subtitle={lang === 'en' ? a.product.nameEn : a.product.nameMn} />
      <Card className="items-center">
        <StatusPill status={a.status} />
        <Text className="mt-3 font-display text-[32px] text-ink dark:text-ink-inverse">{formatMNT(a.amount)}</Text>
        <Text variant="caption">{a.termMonths} {t('common.months')} · {formatMNT(a.quote.monthlyPayment)}{t('common.perMonth')}</Text>
      </Card>

      <Text variant="h3" className="mb-3 mt-7">{t('status.timeline')}</Text>
      <Card>
        {flow.map((s, i) => {
          const done = reached(s);
          const current = a.status === s;
          const bad = s === 'REJECTED' || s === 'CANCELLED';
          const at = [...a.history].reverse().find((h) => h.status === s)?.at;
          return (
            <View key={s} className="flex-row gap-4">
              <View className="items-center">
                <View className={`h-8 w-8 items-center justify-center rounded-full ${bad ? 'bg-danger' : done ? 'bg-brand' : 'bg-surface-alt dark:bg-surface-altdark'}`}>
                  {bad ? <X size={16} color="#fff" /> : done ? (current && s !== 'COMPLETED' && s !== 'DISBURSED' ? <Clock size={16} color="#fff" /> : <Check size={16} color="#fff" />) : <View className="h-2 w-2 rounded-full bg-ink-muted" />}
                </View>
                {i < flow.length - 1 && <View className={`w-0.5 flex-1 ${done && reached(flow[i + 1]) ? 'bg-brand' : 'bg-line dark:bg-line-dark'}`} style={{ minHeight: 28 }} />}
              </View>
              <View className="flex-1 pb-5">
                <Text className={`font-inter-semibold text-[15px] ${done ? 'text-ink dark:text-ink-inverse' : 'text-ink-muted'}`}>{t(`status.${s}` as never)}</Text>
                {at && <Text variant="caption" className="mt-0.5 text-[12px]">{formatDateTime(at, lang)}</Text>}
              </View>
            </View>
          );
        })}
      </Card>

      {a.status === 'REJECTED' && a.decisionReason && <View className="mt-4"><Notice>{a.decisionReason}</Notice></View>}
      {a.status === 'INFO_REQUESTED' && (
        <Card className="mt-4">
          <Notice tone="info">{a.infoRequest ?? ''}</Notice>
          <Input className="mt-4" label={t('status.updateInfo')} value={reply} onChangeText={setReply} multiline />
          <Button title={t('common.continue')} disabled={reply.trim().length < 2} loading={busy} onPress={() => act(() => api(`/applications/${id}/respond`, { body: { message: reply } }))} />
          <Button title={t('profile.employment')} variant="ghost" size="md" onPress={() => router.push('/profile/employment')} />
        </Card>
      )}

      <Card className="mt-4">
        <Row label={t('calculator.principal')} value={formatMNT(a.quote.principal)} />
        <Row label={t('calculator.interest')} value={formatMNT(a.quote.totalInterest)} />
        <Row label={t('calculator.fee')} value={formatMNT(a.quote.serviceFee)} />
        <Row label={t('calculator.total')} value={formatMNT(a.quote.totalRepayment)} strong />
      </Card>

      {err ? <ErrorView error={err} /> : null}
      {a.loanId && <Button title={t('loans.title')} className="mt-5" onPress={() => router.push(`/loans/${a.loanId}`)} />}
      {['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(a.status) && <Button title={t('status.cancelApplication')} variant="outline" className="mt-5" loading={busy} onPress={cancel} />}
    </Screen>
  );
}
