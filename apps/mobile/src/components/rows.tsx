import { daysUntil, formatDate, formatMNT, type LoanDto, type TransactionDto } from '@orgil/shared';
import { router } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Percent, RotateCcw, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { ProgressRing } from './finance';
import { Card, StatusPill, Text } from './ui';

export function TransactionRow({ tx }: { tx: TransactionDto }) {
  const { t, lang } = useI18n();
  const credit = tx.direction === 'CREDIT';
  const Icon = tx.type === 'FEE' ? Percent : tx.type === 'PENALTY' ? TriangleAlert : tx.type === 'REFUND' ? RotateCcw : credit ? ArrowDownLeft : ArrowUpRight;
  return (
    <View className="flex-row items-center gap-3 py-3">
      <View className={`h-11 w-11 items-center justify-center rounded-2xl ${credit ? 'bg-mint-soft dark:bg-mint/15' : 'bg-brand-soft dark:bg-brand/15'}`}>
        <Icon size={20} color={credit ? '#14936B' : '#FF5533'} />
      </View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-[14px] text-ink dark:text-ink-inverse">{t(`transactions.types.${tx.type}` as never)}</Text>
        <Text variant="caption" className="text-[12px]" numberOfLines={1}>{tx.loanNo ?? tx.description} · {formatDate(tx.createdAt, lang)}</Text>
      </View>
      <Text className={`font-inter-bold text-[15px] ${credit ? 'text-emerald-700 dark:text-mint' : 'text-ink dark:text-ink-inverse'}`}>{credit ? '+' : '−'}{formatMNT(tx.amount)}</Text>
    </View>
  );
}

export function LoanCard({ loan }: { loan: LoanDto }) {
  const { t, lang } = useI18n();
  const { iconMuted } = useTheme();
  const days = loan.nextDue ? daysUntil(loan.nextDue.date) : null;
  return (
    <Card onPress={() => router.push(`/loans/${loan.id}`)} className="mb-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text variant="micro">{loan.loanNo}</Text>
          <Text variant="h3" className="mt-1">{lang === 'en' ? loan.product.nameEn : loan.product.nameMn}</Text>
        </View>
        <ProgressRing progress={loan.progress} size={52} />
      </View>
      <View className="mt-4 flex-row justify-between">
        <View>
          <Text variant="caption" className="text-[12px]">{t('loans.remainingPrincipal')}</Text>
          <Text className="mt-0.5 font-display-bold text-[20px] text-ink dark:text-ink-inverse">{formatMNT(loan.outstandingPrincipal)}</Text>
        </View>
        {loan.status !== 'ACTIVE' && <StatusPill status={loan.status} />}
      </View>
      {loan.nextDue && (
        <View className={`mt-4 flex-row items-center gap-2 rounded-2xl px-3 py-2.5 ${days !== null && days < 0 ? 'bg-danger-soft dark:bg-danger/15' : 'bg-surface-alt dark:bg-surface-altdark'}`}>
          <CalendarClock size={16} color={days !== null && days < 0 ? '#EF5350' : iconMuted} />
          <Text className="flex-1 text-[13px] text-ink dark:text-ink-inverse">{formatDate(loan.nextDue.date, lang)} · {days! < 0 ? t('home.overdueBy', { d: -days! }) : days === 0 ? t('home.dueToday') : t('home.dueIn', { d: days! })}</Text>
          <Text className="font-inter-bold text-[13px] text-ink dark:text-ink-inverse">{formatMNT(loan.nextDue.amount)}</Text>
        </View>
      )}
    </Card>
  );
}
