import { formatPhone } from '@orgil/shared';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  Bell, Briefcase, CircleHelp, Fingerprint, Globe, KeyRound, Landmark, LogOut, MonitorSmartphone, Moon, ShieldCheck, UserRound, Lock,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, Switch, View } from 'react-native';
import { Card, Divider, ListItem, Screen, Segmented, StatusPill, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useMe } from '@/lib/queries';
import { KEYS, prefs } from '@/lib/storage';
import { useTheme } from '@/lib/theme';

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const { signOut, biometric, setBiometricEnabled } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const { c } = useTheme();
  const { data: me } = useMe();
  const [info, setInfo] = useState<'privacy' | 'help' | null>(null);
  const [themePref, setThemePref] = useState<'system' | 'light' | 'dark'>(colorScheme === 'dark' ? 'dark' : 'light');
  const ic = (I: typeof Bell) => <I size={20} color={c.primary} />;
  const kyc = me?.profile.kycStatus ?? 'NOT_STARTED';

  const logout = () => {
    if (Platform.OS === 'web') return void signOut().then(() => router.replace('/(auth)/login'));
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => void signOut().then(() => router.replace('/(auth)/login')) },
    ]);
  };
  const changeTheme = (v: 'system' | 'light' | 'dark') => {
    setThemePref(v);
    setColorScheme(v);
    void prefs.set(KEYS.theme, v);
  };

  return (
    <Screen>
      <View className="mb-5 mt-3"><Text variant="h1">{t('profile.title')}</Text></View>
      <Card className="flex-row items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-[22px] bg-navy dark:bg-brand"><Text className="font-display text-[24px] text-white">{(me?.profile.firstName ?? 'О').slice(0, 1)}</Text></View>
        <View className="flex-1">
          <Text variant="h3">{[me?.profile.lastName, me?.profile.firstName].filter(Boolean).join(' ') || '—'}</Text>
          <Text variant="caption" className="mt-0.5">{me ? formatPhone(me.phone) : ''}</Text>
        </View>
        <StatusPill status={kyc === 'VERIFIED' ? 'APPROVED' : kyc === 'PENDING' ? 'UNDER_REVIEW' : kyc === 'REJECTED' ? 'REJECTED' : 'PENDING'} label={t(`profile.kyc.${kyc}` as never)} />
      </Card>

      <Text variant="micro" className="mb-1 ml-1 mt-7">{t('profile.personal')}</Text>
      <Card className="py-1">
        <ListItem icon={ic(UserRound)} title={t('profile.personal')} subtitle={me?.profile.email ?? undefined} onPress={() => router.push('/profile/personal')} />
        <Divider />
        <ListItem icon={ic(ShieldCheck)} title={t('profile.idVerification')} subtitle={t(`profile.kyc.${kyc}` as never)} onPress={() => router.push('/profile/kyc')} />
        <Divider />
        <ListItem icon={ic(Landmark)} title={t('profile.bankAccounts')} onPress={() => router.push('/profile/bank-accounts')} />
        <Divider />
        <ListItem icon={ic(Briefcase)} title={t('profile.employment')} subtitle={me?.profile.employerName ?? undefined} onPress={() => router.push('/profile/employment')} />
      </Card>

      <Text variant="micro" className="mb-1 ml-1 mt-7">{t('profile.security')}</Text>
      <Card className="py-1">
        <ListItem icon={ic(KeyRound)} title={t('profile.changePassword')} onPress={() => router.push('/profile/security')} />
        <Divider />
        {biometric.available && (
          <>
            <ListItem icon={ic(Fingerprint)} title={`${t('profile.biometric')}`} subtitle={biometric.label} right={<Switch value={biometric.enabled} onValueChange={(v) => void setBiometricEnabled(v)} trackColor={{ true: c.primary, false: c.border }} />} />
            <Divider />
          </>
        )}
        <ListItem icon={ic(MonitorSmartphone)} title={t('profile.sessions')} onPress={() => router.push('/profile/security')} />
      </Card>

      <Text variant="micro" className="mb-1 ml-1 mt-7">{t('profile.notificationPrefs')}</Text>
      <Card className="py-1">
        <ListItem icon={ic(Bell)} title={t('profile.notificationPrefs')} onPress={() => router.push('/profile/notifications')} />
        <Divider />
        <View className="py-3">
          <View className="mb-3 flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-2xl bg-surface-alt dark:bg-surface-altdark">{ic(Globe)}</View><Text variant="bodyStrong">{t('profile.language')}</Text></View>
          <Segmented value={lang} onChange={setLang} items={[{ value: 'mn', label: 'Монгол' }, { value: 'en', label: 'English' }]} />
        </View>
        <Divider />
        <View className="py-3">
          <View className="mb-3 flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-2xl bg-surface-alt dark:bg-surface-altdark">{ic(Moon)}</View><Text variant="bodyStrong">{t('profile.theme')}</Text></View>
          <Segmented value={themePref} onChange={changeTheme} items={[{ value: 'system', label: t('profile.themes.system') }, { value: 'light', label: t('profile.themes.light') }, { value: 'dark', label: t('profile.themes.dark') }]} />
        </View>
      </Card>

      <Card className="mt-7 py-1">
        <ListItem icon={ic(Lock)} title={t('profile.privacy')} onPress={() => setInfo('privacy')} />
        <Divider />
        <ListItem icon={ic(CircleHelp)} title={t('profile.help')} onPress={() => setInfo('help')} />
        <Divider />
        <ListItem icon={<LogOut size={20} color="#EF5350" />} title={t('profile.logout')} danger onPress={logout} />
      </Card>
      <Text variant="caption" className="mt-6 text-center text-[12px]">{t('profile.version')} {Constants.expoConfig?.version ?? '0.1.0'}</Text>

      <Modal visible={!!info} transparent animationType="slide" onRequestClose={() => setInfo(null)}>
        <Pressable className="flex-1 justify-end bg-navy/50" onPress={() => setInfo(null)}>
          <Pressable className="rounded-t-[28px] bg-surface p-6 pb-10 dark:bg-surface-dark">
            <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-line dark:bg-line-dark" />
            <Text variant="h2">{info === 'privacy' ? t('profile.privacy') : t('profile.help')}</Text>
            <Text variant="body" className="mt-3 text-ink-muted">{info === 'privacy' ? t('profile.privacyBody') : t('profile.helpBody')}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
