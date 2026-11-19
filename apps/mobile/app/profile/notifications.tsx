import type { MeDto, NotificationPrefs } from '@orgil/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Switch, View } from 'react-native';
import { Card, Divider, ErrorView, Header, Screen, Skeleton, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { qk, useMe } from '@/lib/queries';
import { useTheme } from '@/lib/theme';
import { useState } from 'react';

const KEYS: (keyof NotificationPrefs)[] = ['push', 'sms', 'email', 'repaymentReminders', 'marketing'];

export default function NotificationPrefsScreen() {
  const { t } = useI18n();
  const { c } = useTheme();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [error, setError] = useState<unknown>(null);

  const toggle = async (k: keyof NotificationPrefs, v: boolean) => {
    if (!me) return;
    const prefs = { ...me.notificationPrefs, [k]: v };
    qc.setQueryData<MeDto>(qk.me, { ...me, notificationPrefs: prefs }); // optimistic
    try {
      setError(null);
      await api('/me/settings', { method: 'PATCH', body: { notificationPrefs: prefs } });
    } catch (e) {
      setError(e);
      await qc.invalidateQueries({ queryKey: qk.me });
    }
  };

  return (
    <Screen>
      <Header title={t('profile.notificationPrefs')} />
      {error ? <ErrorView error={error} /> : null}
      {!me ? <Skeleton className="h-64" /> : (
        <Card className="py-1">
          {KEYS.map((k, i) => (
            <View key={k}>
              {i > 0 && <Divider />}
              <View className="flex-row items-center justify-between py-4">
                <Text variant="bodyStrong">{t(`profile.prefs.${k}` as never)}</Text>
                <Switch value={!!me.notificationPrefs[k]} onValueChange={(v) => void toggle(k, v)} trackColor={{ true: c.primary, false: c.border }} />
              </View>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
