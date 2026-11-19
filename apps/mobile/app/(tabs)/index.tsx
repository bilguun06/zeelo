import { daysUntil, formatDate, formatMNT } from '@orgil/shared';
import { gradients } from '@orgil/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aurora, GradientTile } from '@/components/three-d';
import { Bell, Calculator, CreditCard, History, Wallet } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { CreditLimitCard, FlowChart } from '@/components/finance';
import { LoanCard, TransactionRow } from '@/components/rows';
import { Card, Empty, ErrorView, haptic, IconButton, Screen, Section, Skeleton, StatusPill, Text } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useDashboard, useMe } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

export default function Home() {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const dash = useDashboard();
  const d = dash.data;
  const firstName = me.data?.profile.firstName;
  const refresh = () => { void me.refetch(); void dash.refetch(); };

  const actions = [
    { label: t('home.quickCalc'), icon: Calculator, tone: 'blue' as const, onPress: () => router.push('/calculator') },
    { label: t('home.quickPay'), icon: CreditCard, tone: 'mint' as const, onPress: () => (d?.nextRepayment ? router.push(`/repay/${d.nextRepayment.loanId}`) : router.push('/(tabs)/loans')) },
    { label: t('home.quickLoans'), icon: Wallet, tone: 'violet' as const, onPress: () => router.push('/(tabs)/loans') },
    { label: t('home.quickHistory'), icon: History, tone: 'amber' as const, onPress: () => router.push('/transactions') },
  ];

  return (
    <Screen refreshing={dash.isRefetching} onRefresh={refresh} edges={[]}>
      <StatusBar style="light" />
      {/* Immersive hero: deep gradient + drifting aurora behind greeting and the 3D card */}
      <View className="-mx-5 overflow-hidden rounded-b-[40px] px-5" style={{ paddingTop: insets.top + 10, paddingBottom: 30 }}>
        <LinearGradient colors={[...gradients.hero]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
        <Aurora height={560} />
        <View className="mb-7 mt-2 flex-row items-center justify-between">
          <Pressable onPress={() => router.push('/(tabs)/profile')} className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <Text className="font-display text-[18px] text-white">{(firstName ?? 'О').slice(0, 1)}</Text>
            </View>
            <View>
              <Text className="font-inter-medium text-[13px] text-white/60">{t('home.greeting')}</Text>
              <Text className="font-display-bold text-[18px] text-white">{firstName ?? me.data?.phone ?? '…'}</Text>
            </View>
          </Pressable>
          <Pressable accessibilityLabel={t('notifications.title')} onPress={() => { haptic.tap(); router.push('/notifications'); }} className="h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 active:opacity-70">
            <Bell size={22} color="#fff" />
            {!!d?.unreadNotifications && <View className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full border-2 border-navy bg-mint" />}
          </Pressable>
        </View>

        {dash.error ? <ErrorView error={dash.error} onRetry={refresh} /> : null}
        {!d ? <View className="h-[330px] rounded-[28px] bg-white/10" /> : (
          <CreditLimitCard limit={d.creditLimit.limit} available={d.creditLimit.available} used={d.creditLimit.used} indicative={d.creditLimit.isIndicative} onApply={() => router.push('/apply')} />
        )}
      </View>

      <View className="mt-6 flex-row justify-between">
        {actions.map((a) => (
          <Pressable key={a.label} onPress={() => { haptic.tap(); a.onPress(); }} className="w-[23%] items-center active:opacity-70">
            <GradientTile tone={a.tone}><a.icon size={24} color="#fff" strokeWidth={2.2} /></GradientTile>
            <Text variant="caption" className="mt-2.5 text-center text-[12px] text-ink dark:text-ink-inverse">{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {d?.nextRepayment && (() => {
        const days = daysUntil(d.nextRepayment.date);
        return (
          <Section title={t('home.upcoming')}>
            <Card className="flex-row items-center gap-4">
              <View className={`h-14 w-14 items-center justify-center rounded-2xl ${days < 0 ? 'bg-danger-soft dark:bg-danger/15' : 'bg-warning-soft dark:bg-warning/15'}`}>
                <Text className={`font-display text-[18px] ${days < 0 ? 'text-danger' : 'text-amber-700 dark:text-warning'}`}>{new Date(d.nextRepayment.date).getDate()}</Text>
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} adjustsFontSizeToFit className="font-display-bold text-[17px] text-ink dark:text-ink-inverse">{formatMNT(d.nextRepayment.amount)}</Text>
                <Text variant="caption" className="text-[12px]" numberOfLines={2}>{formatDate(d.nextRepayment.date, lang)} · {days < 0 ? t('home.overdueBy', { d: -days }) : days === 0 ? t('home.dueToday') : t('home.dueIn', { d: days })}</Text>
              </View>
              <Pressable onPress={() => router.push(`/repay/${d.nextRepayment!.loanId}`)} className="rounded-2xl bg-brand px-3.5 py-3 active:opacity-90">
                <Text className="font-inter-semibold text-[13px] text-white">{t('home.payNow')}</Text>
              </Pressable>
            </Card>
          </Section>
        );
      })()}

      {!!d?.openApplications.length && (
        <Section title={t('home.applications')}>
          {d.openApplications.map((a) => (
            <Card key={a.id} onPress={() => router.push(`/applications/${a.id}`)} className="mb-3 flex-row items-center justify-between">
              <View>
                <Text variant="micro">{a.applicationNo}</Text>
                <Text className="mt-1 font-inter-bold text-[16px] text-ink dark:text-ink-inverse">{formatMNT(a.amount)}</Text>
              </View>
              <StatusPill status={a.status} />
            </Card>
          ))}
        </Section>
      )}

      <Section title={t('home.activeLoans')} action={d?.activeLoans.length ? { label: t('common.seeAll'), onPress: () => router.push('/(tabs)/loans') } : undefined}>
        {!d ? <Skeleton className="h-40" /> : d.activeLoans.length ? d.activeLoans.slice(0, 2).map((l) => <LoanCard key={l.id} loan={l} />) : (
          <Card><Empty title={t('home.noActiveLoans')} /></Card>
        )}
      </Section>

      {d && (
        <Section title={t('home.overview')}>
          <Card>
            <View className="mb-1 flex-row justify-between">
              <Text variant="caption">{t('home.totalOutstanding')}</Text>
              <Text className="font-inter-bold text-[14px] text-ink dark:text-ink-inverse">{formatMNT(d.totalOutstanding)}</Text>
            </View>
            <FlowChart data={d.overview} />
          </Card>
        </Section>
      )}

      <Section title={t('home.recent')} action={{ label: t('common.seeAll'), onPress: () => router.push('/transactions') }}>
        <Card className="py-2">
          {!d ? <Skeleton className="h-32" /> : d.recentTransactions.length ? d.recentTransactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />) : <Empty title={t('transactions.none')} />}
        </Card>
      </Section>
    </Screen>
  );
}
