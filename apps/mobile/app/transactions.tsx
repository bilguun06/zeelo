import type { TransactionType } from '@orgil/shared';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { TransactionRow } from '@/components/rows';
import { Card, Chip, Empty, ErrorView, Header, Screen, Skeleton, Text } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useTransactions } from '@/lib/queries';

const TYPES: TransactionType[] = ['DISBURSEMENT', 'REPAYMENT', 'FEE', 'PENALTY', 'REFUND'];
const PERIODS = { all: 0, d7: 7, d30: 30, d90: 90, y1: 365 } as const;
type Period = keyof typeof PERIODS;

export default function Transactions() {
  const { t, lang } = useI18n();
  const [type, setType] = useState<TransactionType | undefined>();
  const [period, setPeriod] = useState<Period>('all');
  const from = useMemo(() => (PERIODS[period] ? new Date(Date.now() - PERIODS[period] * 86_400_000).toISOString().slice(0, 10) : undefined), [period]);
  const { data, error, refetch, isRefetching } = useTransactions({ type, from });

  // Group by month for scanability.
  const groups = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>['items']>();
    for (const tx of data?.items ?? []) {
      const d = new Date(tx.createdAt);
      const k = lang === 'mn' ? `${d.getFullYear()} оны ${d.getMonth() + 1}-р сар` : d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
      m.set(k, [...(m.get(k) ?? []), tx]);
    }
    return [...m.entries()];
  }, [data, lang]);

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Header title={t('transactions.title')} />
      <Text variant="label" className="mb-2">{t('transactions.filterType')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mb-4" contentContainerClassName="px-5">
        <Chip label={t('common.all')} active={!type} onPress={() => setType(undefined)} />
        {TYPES.map((ty) => <Chip key={ty} label={t(`transactions.types.${ty}` as never)} active={type === ty} onPress={() => setType(ty)} />)}
      </ScrollView>
      <Text variant="label" className="mb-2">{t('transactions.filterPeriod')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mb-5" contentContainerClassName="px-5">
        {(Object.keys(PERIODS) as Period[]).map((p) => <Chip key={p} label={t(`transactions.periods.${p}` as never)} active={period === p} onPress={() => setPeriod(p)} />)}
      </ScrollView>
      {error ? <ErrorView error={error} onRetry={refetch} /> : null}
      {!data ? <Skeleton className="h-80" /> : !data.items.length ? <Empty title={t('transactions.none')} /> : groups.map(([month, items]) => (
        <View key={month} className="mb-5">
          <Text variant="micro" className="mb-2 ml-1">{month}</Text>
          <Card className="py-2">{items.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}</Card>
        </View>
      ))}
    </Screen>
  );
}
