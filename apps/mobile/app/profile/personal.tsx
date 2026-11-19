import { router } from 'expo-router';
import { PersonalForm } from '@/components/forms';
import { Header, Notice, Screen, Skeleton } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useMe } from '@/lib/queries';

export default function PersonalScreen() {
  const { t } = useI18n();
  const { data: me } = useMe();
  return (
    <Screen>
      <Header title={t('profile.personal')} />
      {me?.profile.kycStatus === 'VERIFIED' && <Notice tone="info">{t('profile.kyc.VERIFIED')} — {t('profile.helpBody')}</Notice>}
      {!me ? <Skeleton className="h-96" /> : <PersonalForm me={me} onDone={() => router.back()} />}
    </Screen>
  );
}
