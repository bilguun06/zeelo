import { formatDate, formatDateTime, formatMNT, formatPercent } from '@orgil/shared';
import { gradients } from '@orgil/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Aurora, Sheen } from '@/components/three-d';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ProgressRing } from '@/components/finance';
import { Button, Card, Divider, ErrorView, Header, Row, Screen, Segmented, Skeleton, StatusPill, Text } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useLoan } from '@/lib/queries';

export default function LoanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { data: l, error, refetch, isRefetching } = useLoan(id);
  const [tab, setTab] = useState<'schedule' | 'history'>('schedule');

  if (error) return <Screen><Header title={t('loans.title')} /><ErrorView error={error} onRetry={refetch} /></Screen>;
  if (!l) return <Screen><Header title={t('loans.title')} /><Skeleton className="h-96" /></Screen>;
  const open = l.status === 'ACTIVE' || l.status === 'OVERDUE';

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Header title={lang === 'en' ? l.product.nameEn : l.product.nameMn} subtitle={l.loanNo} right={<StatusPill status={l.status} />} />
      <LinearGradient colors={[...gradients.premium]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, padding: 24, overflow: 'hidden', shadowColor: '#FF5533', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } }}>
        <Aurora height={220} />
        <Sheen />
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[13px] text-white/60">{t('loans.remainingPrincipal')}</Text>
            <Text className="mt-1 font-display text-[30px] text-white">{formatMNT(l.outstandingPrincipal)}</Text>
          </View>
          <ProgressRing progress={l.progress} size={64} onDark />
        </View>
        <View className="mt-5 flex-row justify-between">
          <View><Text className="text-[12px] text-white/50">{t('loans.totalOutstanding')}</Text><Text className="mt-0.5 font-inter-semibold text-[14px] text-white">{formatMNT(l.totalOutstanding)}</Text></View>
          <View><Text className="text-[12px] text-white/50">{t('loans.interestPaid')}</Text><Text className="mt-0.5 font-inter-semibold text-[14px] text-white">{formatMNT(l.interestPaid)}</Text></View>
          <View><Text className="text-[12px] text-white/50">{t('products.interest')}</Text><Text className="mt-0.5 font-inter-semibold text-[14px] text-white">{formatPercent(l.monthlyInterestRate)}</Text></View>
        </View>
      </LinearGradient>

      {open && l.nextDue && (
        <Card className="mt-4">
          <Row label={t('loans.nextPayment')} value={formatMNT(l.nextDue.amount)} strong />
          <Row label={t('calculator.date')} value={formatDate(l.nextDue.date, lang)} />
          <Row label={t('loans.payoff')} value={formatMNT(l.payoffAmount)} />
          <Button title={t('loans.pay')} className="mt-3" onPress={() => router.push(`/repay/${l.id}`)} />
        </Card>
      )}

      <Card className="mt-4">
        <Row label={t('loans.disbursed')} value={formatDate(l.disbursedAt, lang)} />
        <Row label={t('loans.maturity')} value={formatDate(l.maturityDate, lang)} />
        <Row label={t('loans.progress')} value={t('loans.installments', { a: l.paidInstallments, b: l.termMonths })} />
      </Card>

      <View className="mb-3 mt-7"><Segmented value={tab} onChange={setTab} items={[{ value: 'schedule', label: t('loans.schedule') }, { value: 'history', label: t('loans.history') }]} /></View>
      <Card className="py-2">
        {tab === 'schedule' ? l.schedule.map((s, i) => (
          <View key={s.id}>
            {i > 0 && <Divider />}
            <View className="flex-row items-center py-3">
              <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-surface-alt dark:bg-surface-altdark"><Text className="font-inter-bold text-[13px] text-ink dark:text-ink-inverse">{s.installmentNo}</Text></View>
              <View className="flex-1">
                <Text className="font-inter-semibold text-[14px] text-ink dark:text-ink-inverse">{formatMNT(s.totalDue)}</Text>
                <Text variant="caption" className="text-[12px]">{formatDate(s.dueDate, lang)}{Number(s.penaltyDue) > 0 ? ` · ${t('repay.penalty')} ${formatMNT(s.penaltyDue)}` : ''}</Text>
              </View>
              <StatusPill status={s.status} />
            </View>
          </View>
        )) : l.repayments.length ? l.repayments.map((r, i) => (
          <View key={r.id}>
            {i > 0 && <Divider />}
            <Pressable className="flex-row items-center py-3 active:opacity-70" onPress={() => router.push(`/receipt/${r.id}`)}>
              <View className="flex-1">
                <Text className="font-inter-semibold text-[14px] text-ink dark:text-ink-inverse">{formatMNT(r.amount)}</Text>
                <Text variant="caption" className="text-[12px]">{formatDateTime(r.paidAt, lang)} · {r.receiptNo}{r.sandbox ? ' · SANDBOX' : ''}</Text>
              </View>
              <Text className="font-inter-semibold text-[13px] text-brand">{t('repay.receipt')}</Text>
            </Pressable>
          </View>
        )) : <Text variant="caption" className="py-6 text-center">{t('common.empty')}</Text>}
      </Card>
    </Screen>
  );
}
