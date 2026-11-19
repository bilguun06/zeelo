import { formatDateTime } from '@orgil/shared';
import { passwordSchema } from '@orgil/validation';
import { useQuery } from '@tanstack/react-query';
import { MonitorSmartphone } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Divider, ErrorView, haptic, Header, Input, Notice, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useErrorText, useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

interface Session { id: string; deviceName: string | null; ip: string | null; lastUsedAt: string; current: boolean }

export default function Security() {
  const { t, lang } = useI18n();
  const tr = useErrorText();
  const { c } = useTheme();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api<Session[]>('/me/sessions') });
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [fieldErr, setFieldErr] = useState<string>();
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function change() {
    const p = passwordSchema.safeParse(next);
    if (!p.success) { setFieldErr(tr(p.error.issues[0].message)); haptic.error(); return; }
    setFieldErr(undefined); setError(null); setLoading(true);
    try {
      await api('/auth/password/change', { body: { currentPassword: current, newPassword: next } });
      haptic.success(); setDone(true); setCurrent(''); setNext('');
      await sessions.refetch();
    } catch (e) { setError(e); haptic.error(); } finally { setLoading(false); }
  }

  return (
    <Screen>
      <Header title={t('profile.security')} />
      <Card>
        <Text variant="h3" className="mb-4">{t('profile.changePassword')}</Text>
        <Input label={t('auth.password')} secureTextEntry value={current} onChangeText={setCurrent} />
        <Input label={t('auth.resetPassword')} secureTextEntry value={next} onChangeText={setNext} error={fieldErr} hint={t('auth.passwordHint')} />
        {done && <View className="mb-4"><Notice tone="info">{t('auth.resetDone')}</Notice></View>}
        {error ? <ErrorView error={error} /> : null}
        <Button title={t('common.save')} onPress={change} loading={loading} disabled={!current || !next} />
      </Card>

      <Text variant="h3" className="mb-3 mt-7">{t('profile.sessions')}</Text>
      <Card className="py-1">
        {sessions.data?.map((s, i) => (
          <View key={s.id}>
            {i > 0 && <Divider />}
            <View className="flex-row items-center gap-3 py-3.5">
              <MonitorSmartphone size={20} color={c.primary} />
              <View className="flex-1">
                <Text variant="bodyStrong">{s.deviceName ?? '—'}{s.current ? ' ·  ✓' : ''}</Text>
                <Text variant="caption" className="text-[12px]">{s.ip ?? ''} · {formatDateTime(s.lastUsedAt, lang)}</Text>
              </View>
              {!s.current && (
                <Pressable onPress={async () => { await api(`/me/sessions/${s.id}`, { method: 'DELETE' }); await sessions.refetch(); }} hitSlop={8}>
                  <Text className="font-inter-semibold text-[13px] text-danger">{t('profile.logout')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
