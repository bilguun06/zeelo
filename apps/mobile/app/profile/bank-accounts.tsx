import type { BankAccountDto } from '@orgil/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Landmark, Star, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { BankAccountForm } from '@/components/forms';
import { Button, Card, ErrorView, Header, Screen, Skeleton, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { qk, useBankAccounts, useMe } from '@/lib/queries';

export default function BankAccounts() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: accounts } = useBankAccounts();
  const { data: me } = useMe();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.bankAccounts });
  const primary = async (a: BankAccountDto) => { try { await api(`/me/bank-accounts/${a.id}/primary`, { method: 'POST' }); await refresh(); } catch (e) { setError(e); } };
  const remove = (a: BankAccountDto) => {
    const run = async () => { try { setError(null); await api(`/me/bank-accounts/${a.id}`, { method: 'DELETE' }); await refresh(); } catch (e) { setError(e); } };
    if (Platform.OS === 'web') return void run();
    Alert.alert(a.bankName, a.accountNumberMasked, [{ text: t('common.cancel'), style: 'cancel' }, { text: 'Устгах', style: 'destructive', onPress: () => void run() }]);
  };

  return (
    <Screen>
      <Header title={t('profile.bankAccounts')} />
      {error ? <ErrorView error={error} /> : null}
      {!accounts ? <Skeleton className="h-40" /> : accounts.map((a) => (
        <Card key={a.id} className="mb-3 flex-row items-center gap-4">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft dark:bg-brand/20"><Landmark size={20} color="#FF5533" /></View>
          <View className="flex-1">
            <Text variant="bodyStrong">{a.bankName}</Text>
            <Text variant="caption" className="text-[12px]">{a.accountNumberMasked} · {a.accountHolder}</Text>
          </View>
          <Pressable onPress={() => !a.isPrimary && primary(a)} hitSlop={8} className="p-1"><Star size={20} color={a.isPrimary ? '#FFB547' : '#8C8481'} fill={a.isPrimary ? '#FFB547' : 'transparent'} /></Pressable>
          <Pressable onPress={() => remove(a)} hitSlop={8} className="p-1"><Trash2 size={20} color="#EF5350" /></Pressable>
        </Card>
      ))}
      {adding ? (
        <Card className="mt-2"><BankAccountForm defaultHolder={[me?.profile.lastName, me?.profile.firstName].filter(Boolean).join(' ')} onDone={() => setAdding(false)} /></Card>
      ) : <Button title={`+ ${t('apply.addAccount')}`} variant="outline" onPress={() => setAdding(true)} className="mt-2" />}
    </Screen>
  );
}
