import { router } from 'expo-router';
import { KycUploader } from '@/components/forms';
import { Header, Screen } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export default function KycScreen() {
  const { t } = useI18n();
  return (
    <Screen>
      <Header title={t('profile.idVerification')} />
      <KycUploader submitLabel={t('common.done')} onDone={() => router.back()} />
    </Screen>
  );
}
