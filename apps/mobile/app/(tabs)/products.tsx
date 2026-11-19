import { formatMNT, formatPercent, type LoanProductDto } from '@orgil/shared';
import { router } from 'expo-router';
import { CheckCircle2, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import { ProductArt } from '@/components/product-art';
import { Button, Card, Empty, ErrorView, Screen, Skeleton, Text } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useProducts } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

function ProductCard({ p }: { p: LoanProductDto }) {
  const { t, lang } = useI18n();
  const { iconMuted } = useTheme();
  const [open, setOpen] = useState(false);
  const terms = p.allowedTerms;
  const e = p.eligibility;
  const reqs = [
    e.minMonthlyIncome && t('products.minIncome', { v: formatMNT(e.minMonthlyIncome) }),
    e.minAgeYears && t('products.minAge', { v: e.minAgeYears }),
    e.minEmploymentMonths && t('products.minEmployment', { v: e.minEmploymentMonths }),
    e.requiresKyc && t('products.kyc'),
  ].filter(Boolean) as string[];

  return (
    <Card className="mb-4">
      <View className="flex-row items-center gap-4">
        <ProductArt category={p.category} />
        <View className="flex-1">
          <Text variant="h3">{lang === 'en' ? p.nameEn : p.nameMn}</Text>
          <Text variant="caption" className="mt-0.5 text-[12px]" numberOfLines={2}>{lang === 'en' ? p.descriptionEn : p.descriptionMn}</Text>
        </View>
      </View>
      <View className="mt-4 flex-row rounded-[18px] bg-surface-alt p-3 dark:bg-surface-altdark">
        <View className="flex-1"><Text variant="caption" className="text-[11px]">{t('products.maxAmount')}</Text><Text className="mt-0.5 font-inter-bold text-[14px] text-ink dark:text-ink-inverse">{formatMNT(p.maxAmount)}</Text></View>
        <View className="flex-1"><Text variant="caption" className="text-[11px]">{t('products.duration')}</Text><Text className="mt-0.5 font-inter-bold text-[14px] text-ink dark:text-ink-inverse">{terms.length > 1 ? t('products.range', { a: terms[0], b: terms[terms.length - 1] }) : t('products.upTo', { n: terms[0] })}</Text></View>
        <View className="flex-1"><Text variant="caption" className="text-[11px]">{t('products.interest')}</Text><Text className="mt-0.5 font-inter-bold text-[14px] text-ink dark:text-ink-inverse">{formatPercent(p.monthlyInterestRate)}</Text></View>
      </View>
      <Pressable onPress={() => { LayoutAnimation.easeInEaseOut(); setOpen(!open); }} className="mt-3 flex-row items-center justify-between py-1">
        <Text className="font-inter-semibold text-[13px] text-ink-muted">{t('products.eligibility')} · {t('products.fee')} {formatPercent(p.serviceFeePercent)}{Number(p.serviceFeeFixed) > 0 ? ` + ${formatMNT(p.serviceFeeFixed)}` : ''}</Text>
        <ChevronDown size={18} color={iconMuted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open && (
        <View className="mt-1">
          {reqs.map((r) => <View key={r} className="flex-row items-center gap-2 py-1"><CheckCircle2 size={14} color="#14936B" /><Text className="text-[13px] text-ink dark:text-ink-inverse">{r}</Text></View>)}
          <Text variant="caption" className="mt-2 text-[11px]">{t('calculator.rateFromProvider')}</Text>
        </View>
      )}
      <View className="mt-4 flex-row gap-3">
        <Button title={t('products.calculate')} variant="secondary" size="md" className="flex-1" onPress={() => router.push({ pathname: '/calculator', params: { productId: p.id } })} />
        <Button title={t('products.apply')} size="md" className="flex-1" onPress={() => router.push({ pathname: '/apply', params: { productId: p.id } })} />
      </View>
    </Card>
  );
}

export default function Products() {
  const { t } = useI18n();
  const { data, error, refetch, isRefetching } = useProducts();
  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <View className="mb-5 mt-3">
        <Text variant="h1">{t('products.title')}</Text>
        <Text variant="caption" className="mt-1 text-[14px]">{t('products.subtitle')}</Text>
      </View>
      {error ? <ErrorView error={error} onRetry={refetch} /> : null}
      {!data ? [0, 1, 2].map((i) => <Skeleton key={i} className="mb-4 h-56" />) : data.length ? data.map((p) => <ProductCard key={p.id} p={p} />) : <Empty title={t('products.none')} />}
    </Screen>
  );
}
