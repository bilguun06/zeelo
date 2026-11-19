import { calculateQuote } from '@orgil/financial-engine';
import { formatPercent } from '@orgil/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AmountPicker } from '@/components/amount-picker';
import { QuoteView } from '@/components/quote-view';
import { Button, Card, Chip, Empty, ErrorView, Header, Notice, Screen, Skeleton, Text } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useProducts } from '@/lib/queries';

/**
 * Example calculator. Pricing comes from the lender's configured products (never hardcoded);
 * computation uses the same decimal engine as the server, so numbers match the contract quote.
 */
export default function CalculatorScreen() {
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ productId?: string }>();
  const { data: products, error, refetch } = useProducts();
  const [productId, setProductId] = useState<string | undefined>(params.productId);
  const product = products?.find((p) => p.id === productId) ?? products?.[0];
  const [amount, setAmount] = useState(0);
  const [term, setTerm] = useState(0);

  useEffect(() => {
    if (!product) return;
    const min = Number(product.minAmount), max = Number(product.maxAmount), step = Number(product.amountStep);
    const target = Math.min(max, Math.max(min, 2_000_000));
    setAmount(Math.round((target - min) / step) * step + min);
    setTerm(product.allowedTerms.includes(12) ? 12 : product.allowedTerms[Math.floor(product.allowedTerms.length / 2)]);
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const quote = useMemo(() => {
    if (!product || !amount || !term) return null;
    try {
      return calculateQuote({ ...product, principal: String(amount), termMonths: term });
    } catch {
      return null;
    }
  }, [product, amount, term]);

  return (
    <Screen>
      <Header title={t('calculator.title')} />
      {error ? <ErrorView error={error} onRetry={refetch} /> : null}
      {!products ? <Skeleton className="h-96" /> : !product ? <Empty title={t('products.none')} /> : (
        <>
          <Text variant="label" className="mb-2">{t('calculator.product')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mb-5" contentContainerClassName="px-5">
            {products.map((p) => <Chip key={p.id} label={lang === 'en' ? p.nameEn : p.nameMn} active={p.id === product.id} onPress={() => setProductId(p.id)} />)}
          </ScrollView>

          <Card>
            <Text variant="label" className="mb-3">{t('calculator.amount')}</Text>
            <AmountPicker value={amount} min={Number(product.minAmount)} max={Number(product.maxAmount)} step={Number(product.amountStep)} onChange={setAmount} />
            <Text variant="label" className="mb-3 mt-6">{t('calculator.term')}</Text>
            <View className="flex-row flex-wrap gap-y-2">
              {product.allowedTerms.map((m) => <Chip key={m} label={`${m} ${t('common.monthsShort')}`} active={m === term} onPress={() => setTerm(m)} />)}
            </View>
            <View className="mt-5 flex-row justify-between rounded-2xl bg-surface-alt p-3 dark:bg-surface-altdark">
              <Text variant="caption" className="text-[12px]">{t('products.interest')}: <Text className="font-inter-semibold text-[12px] text-ink dark:text-ink-inverse">{formatPercent(product.monthlyInterestRate)}</Text></Text>
              <Text variant="caption" className="text-[12px]">{t(`calculator.method.${product.repaymentMethod}` as never)}</Text>
            </View>
          </Card>

          <View className="mt-4">{quote && <QuoteView quote={quote} feeDeducted={product.feeCollection === 'DEDUCTED_FROM_DISBURSEMENT'} />}</View>
          <View className="mt-4"><Notice>{`${t('common.demo')}: ${t('calculator.disclaimer')}`}</Notice></View>
          <Button title={t('calculator.applyWith')} className="mt-5" onPress={() => router.push({ pathname: '/apply', params: { productId: product.id, amount: String(amount), term: String(term) } })} />
        </>
      )}
    </Screen>
  );
}
