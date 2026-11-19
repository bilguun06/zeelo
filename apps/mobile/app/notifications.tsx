import { formatDateTime, type NotificationCategory, type NotificationDto } from '@orgil/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BadgeCheck, Ban, Banknote, BellRing, CalendarClock, CircleAlert, FileQuestion, Megaphone, ShieldCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Card, Empty, ErrorView, haptic, Header, Screen, Skeleton, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { qk, useNotifications } from '@/lib/queries';

const META: Record<NotificationCategory, { Icon: typeof BellRing; color: string; bg: string }> = {
  LOAN_APPROVED: { Icon: BadgeCheck, color: '#14936B', bg: 'bg-mint-soft dark:bg-mint/15' },
  LOAN_REJECTED: { Icon: Ban, color: '#EF5350', bg: 'bg-danger-soft dark:bg-danger/15' },
  INFO_REQUESTED: { Icon: FileQuestion, color: '#C27C0E', bg: 'bg-warning-soft dark:bg-warning/15' },
  LOAN_DISBURSED: { Icon: Banknote, color: '#FF5533', bg: 'bg-brand-soft dark:bg-brand/15' },
  REPAYMENT_REMINDER: { Icon: CircleAlert, color: '#EF5350', bg: 'bg-danger-soft dark:bg-danger/15' },
  PAYMENT_SUCCESS: { Icon: ShieldCheck, color: '#14936B', bg: 'bg-mint-soft dark:bg-mint/15' },
  DUE_SOON: { Icon: CalendarClock, color: '#C27C0E', bg: 'bg-warning-soft dark:bg-warning/15' },
  ANNOUNCEMENT: { Icon: Megaphone, color: '#FF5533', bg: 'bg-brand-soft dark:bg-brand/15' },
  SYSTEM: { Icon: BellRing, color: '#8C8481', bg: 'bg-surface-alt dark:bg-surface-altdark' },
};

export default function Notifications() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data, error, refetch, isRefetching } = useNotifications();

  const open = async (n: NotificationDto) => {
    haptic.tap();
    if (!n.readAt) {
      void api(`/notifications/${n.id}/read`, { method: 'POST' }).then(() => { void refetch(); void qc.invalidateQueries({ queryKey: qk.dashboard }); });
    }
    const d = n.data ?? {};
    if (typeof d.applicationId === 'string') router.push(`/applications/${d.applicationId}`);
    else if (typeof d.repaymentId === 'string') router.push(`/receipt/${d.repaymentId}`);
    else if (typeof d.loanId === 'string') router.push(`/loans/${d.loanId}`);
  };
  const readAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    await refetch();
    await qc.invalidateQueries({ queryKey: qk.dashboard });
  };

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Header title={t('notifications.title')} right={data?.unread ? <Pressable onPress={readAll}><Text className="font-inter-semibold text-[13px] text-brand">{t('notifications.markAll')}</Text></Pressable> : undefined} />
      {error ? <ErrorView error={error} onRetry={refetch} /> : null}
      {!data ? <Skeleton className="h-80" /> : !data.items.length ? <Empty title={t('notifications.none')} /> : data.items.map((n) => {
        const m = META[n.category] ?? META.SYSTEM;
        return (
          <Card key={n.id} onPress={() => open(n)} className="mb-3 flex-row gap-4">
            <View className={`h-11 w-11 items-center justify-center rounded-2xl ${m.bg}`}><m.Icon size={20} color={m.color} /></View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text variant="micro">{t(`notifications.categories.${n.category}` as never)}</Text>
                {!n.readAt && <View className="h-2 w-2 rounded-full bg-brand" />}
              </View>
              <Text className={`mt-1 text-[15px] ${n.readAt ? 'font-inter-medium' : 'font-inter-bold'} text-ink dark:text-ink-inverse`}>{n.title}</Text>
              <Text variant="caption" className="mt-1 leading-[18px]">{n.body}</Text>
              <Text variant="caption" className="mt-2 text-[11px]">{formatDateTime(n.createdAt, lang)}</Text>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
