import { formatDateTime, formatMNT, type RepaymentDto } from '@orgil/shared';
import { useQuery } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { SuccessBadge } from '@/components/finance';
import { Button, Card, Divider, ErrorView, Header, Notice, Row, Screen, Skeleton, Text } from '@/components/ui';
import { api, API_URL, getAccessToken } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Receipt = RepaymentDto & { loanNo: string; loanStatus: string; outstandingPrincipal: string; interestWaived: string };

export default function ReceiptScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const { t, lang } = useI18n();
  const { data: r, error } = useQuery({ queryKey: ['receipt', id], queryFn: () => api<Receipt>(`/repayments/${id}`) });
  const [sharing, setSharing] = useState(false);
  const [shareErr, setShareErr] = useState<unknown>(null);

  async function share() {
    if (!r) return;
    setSharing(true); setShareErr(null);
    try {
      const url = `${API_URL}/api/v1/documents/receipts/${id}`;
      if (Platform.OS === 'web') {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
        window.open(URL.createObjectURL(await res.blob()), '_blank');
        return;
      }
      const dest = `${FileSystem.cacheDirectory}${r.receiptNo}.pdf`;
      const dl = await FileSystem.downloadAsync(url, dest, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
      if (dl.status !== 200) throw new Error(t('common.error'));
      await Sharing.shareAsync(dl.uri, { mimeType: 'application/pdf', dialogTitle: r.receiptNo });
    } catch (e) { setShareErr(e); } finally { setSharing(false); }
  }

  return (
    <Screen>
      <Header title={t('repay.receipt')} back={!fresh} />
      {error ? <ErrorView error={error} /> : !r ? <Skeleton className="h-96" /> : (
        <>
          {fresh && (
            <View className="mb-6 mt-4 items-center">
              <SuccessBadge />
              <Text variant="h1" className="mt-6">{t('repay.successTitle')}</Text>
              <Text variant="body" className="mt-1 text-ink-muted">{t('repay.successBody')}</Text>
            </View>
          )}
          <Card>
            <View className="items-center pb-4">
              <Text variant="caption">{t('repay.amount')}</Text>
              <Text className="mt-1 font-display text-[32px] text-ink dark:text-ink-inverse">{formatMNT(r.amount)}</Text>
            </View>
            <Divider />
            <Row label={t('repay.receiptNo')} value={r.receiptNo} className="mt-2" />
            <Row label={t('repay.paidAt')} value={formatDateTime(r.paidAt, lang)} />
            <Row label={t('loans.title')} value={r.loanNo} />
            <Row label={t('repay.method')} value={t(`repay.providers.${r.provider}` as never)} />
            <Divider />
            <Text variant="micro" className="mb-1 mt-4">{t('repay.allocation')}</Text>
            <Row label={t('calculator.principal')} value={formatMNT(r.principalPart)} />
            <Row label={t('calculator.interest')} value={formatMNT(r.interestPart)} />
            {Number(r.feePart) > 0 && <Row label={t('calculator.fee')} value={formatMNT(r.feePart)} />}
            {Number(r.penaltyPart) > 0 && <Row label={t('repay.penalty')} value={formatMNT(r.penaltyPart)} />}
            <Divider />
            <Row label={t('loans.remainingPrincipal')} value={formatMNT(r.outstandingPrincipal)} strong className="mt-1" />
          </Card>
          {r.sandbox && <View className="mt-4"><Notice>{t('repay.sandboxNote')}</Notice></View>}
          {shareErr ? <ErrorView error={shareErr} /> : null}
          <Button title={t('repay.share')} variant="secondary" icon={<Share2 size={18} color="#FF5533" />} loading={sharing} onPress={share} className="mt-5" />
          <Button title={t('common.done')} className="mt-3" onPress={() => router.replace('/(tabs)')} />
        </>
      )}
    </Screen>
  );
}
