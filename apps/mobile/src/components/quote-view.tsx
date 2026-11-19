import { formatDate, formatMNT, formatPercent, type QuoteDto } from '@orgil/shared';
import type { Quote } from '@orgil/financial-engine';
import { useState } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { Card, Divider, Row, Text } from './ui';

/** Breakdown of a quote: principal, interest, fee, total, monthly; expandable schedule. */
export function QuoteView({ quote, feeDeducted }: { quote: Quote | QuoteDto; feeDeducted: boolean }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <View className="items-center pb-4">
        <Text variant="caption">{t('calculator.monthly')}</Text>
        <Text className="mt-1 font-display text-[34px] text-brand">{formatMNT(quote.monthlyPayment)}</Text>
        {quote.firstPayment !== quote.monthlyPayment && <Text variant="caption" className="text-[12px]">{t('calculator.firstMonth')}: {formatMNT(quote.firstPayment)}</Text>}
      </View>
      <Divider />
      <Row label={t('calculator.principal')} value={formatMNT(quote.principal)} className="mt-2" />
      <Row label={t('calculator.interest')} value={formatMNT(quote.totalInterest)} />
      <Row label={t('calculator.fee')} value={formatMNT(quote.serviceFee)} />
      {feeDeducted && <Row label={t('calculator.netDisbursement')} value={formatMNT(quote.netDisbursement)} />}
      <Divider />
      <Row label={t('calculator.total')} value={formatMNT(quote.totalRepayment)} strong className="mt-1" />
      <Row label={t('calculator.apr')} value={formatPercent(quote.apr)} />
      <Pressable onPress={() => { LayoutAnimation.easeInEaseOut(); setOpen(!open); }} className="mt-2 items-center rounded-2xl bg-surface-alt py-3 dark:bg-surface-altdark">
        <Text className="font-inter-semibold text-[13px] text-brand">{open ? t('calculator.hideSchedule') : t('calculator.showSchedule')}</Text>
      </Pressable>
      {open && (
        <View className="mt-3">
          <View className="flex-row border-b border-line pb-2 dark:border-line-dark">
            <Text variant="micro" className="w-8">{t('calculator.no')}</Text>
            <Text variant="micro" className="flex-1">{t('calculator.date')}</Text>
            <Text variant="micro" className="flex-1 text-right">{t('calculator.payment')}</Text>
            <Text variant="micro" className="flex-1 text-right">{t('calculator.balance')}</Text>
          </View>
          {quote.schedule.map((s) => (
            <View key={s.installmentNo} className="flex-row border-b border-line/50 py-2.5 dark:border-line-dark/50">
              <Text className="w-8 text-[13px] text-ink-muted">{s.installmentNo}</Text>
              <Text className="flex-1 text-[13px] text-ink dark:text-ink-inverse">{formatDate(s.dueDate, lang)}</Text>
              <Text className="flex-1 text-right font-inter-semibold text-[13px] text-ink dark:text-ink-inverse">{formatMNT(s.payment)}</Text>
              <Text className="flex-1 text-right text-[13px] text-ink-muted">{formatMNT(s.balanceAfter)}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
