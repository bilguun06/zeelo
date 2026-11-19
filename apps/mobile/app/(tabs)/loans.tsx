import { formatDate, formatMNT } from '@orgil/shared';
import { gradients } from '@orgil/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Aurora, Sheen, Tilt3D } from '@/components/three-d';
import { useState } from 'react';
import { View } from 'react-native';
import { LoanCard } from '@/components/rows';
import { Button, Card, Empty, ErrorView, Screen, Segmented, Skeleton, StatusPill, Text } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useApplications, useLoans } from '@/lib/queries';

type Tab = 'active' | 'completed' | 'applications';

export default function MyLoans() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>('active');
  const active = useLoans('active');
  const completed = useLoans('completed');
  const apps = useApplications();
  const q = tab === 'active' ? active : tab === 'completed' ? completed : apps;
  const totalOutstanding = active.data?.reduce((s, l) => s + Number(l.totalOutstanding), 0) ?? 0;

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <View className="mb-5 mt-3">
        <Text variant="h1">{t('loans.title')}</Text>
      </View>
      {tab === 'active' && !!active.data?.length && (
        <Tilt3D max={6} float={false} style={{ marginBottom: 20 }}>
          <LinearGradient colors={[...gradients.premium]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 26, padding: 22, overflow: 'hidden', shadowColor: '#FF5533', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } }}>
            <Aurora height={180} />
            <Sheen />
            <Text className="text-[13px] text-white/65">{t('loans.totalOutstanding')}</Text>
            <Text className="mt-1 font-display text-[30px] text-white">{formatMNT(totalOutstanding.toFixed(2))}</Text>
            <View className="mt-3 self-start rounded-full bg-white/15 px-3 py-1"><Text className="font-inter-semibold text-[12px] text-white">{active.data.length} {t('loans.active').toLowerCase()}</Text></View>
          </LinearGradient>
        </Tilt3D>
      )}
      <Segmented value={tab} onChange={setTab} items={[{ value: 'active', label: t('loans.active') }, { value: 'completed', label: t('loans.completed') }, { value: 'applications', label: t('loans.applications') }]} />
      <View className="mt-5">
        {q.error ? <ErrorView error={q.error} onRetry={() => q.refetch()} /> : null}
        {q.isLoading ? <><Skeleton className="mb-3 h-40" /><Skeleton className="h-40" /></> : null}
        {tab === 'active' && active.data && (active.data.length ? active.data.map((l) => <LoanCard key={l.id} loan={l} />) : <Empty title={t('loans.noLoans')} action={<Button title={t('home.getLoan')} size="md" onPress={() => router.push('/apply')} />} />)}
        {tab === 'completed' && completed.data && (completed.data.length ? completed.data.map((l) => <LoanCard key={l.id} loan={l} />) : <Empty title={t('loans.noCompleted')} />)}
        {tab === 'applications' && apps.data && (apps.data.length ? apps.data.map((a) => (
          <Card key={a.id} onPress={() => router.push(`/applications/${a.id}`)} className="mb-3">
            <View className="flex-row items-start justify-between">
              <View>
                <Text variant="micro">{a.applicationNo}</Text>
                <Text variant="h3" className="mt-1">{lang === 'en' ? a.product.nameEn : a.product.nameMn}</Text>
              </View>
              <StatusPill status={a.status} />
            </View>
            <View className="mt-3 flex-row justify-between">
              <Text className="font-inter-bold text-[16px] text-ink dark:text-ink-inverse">{formatMNT(a.amount)} · {a.termMonths} {t('common.months')}</Text>
              <Text variant="caption">{formatDate(a.createdAt, lang)}</Text>
            </View>
          </Card>
        )) : <Empty title={t('loans.noApplications')} />)}
      </View>
    </Screen>
  );
}
