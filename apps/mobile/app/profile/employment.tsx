import { router } from 'expo-router';
import { EmploymentForm } from '@/components/forms';
import { Header, Screen, Skeleton } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useMe } from '@/lib/queries';

export default function EmploymentScreen() {
  const { t } = useI18n();
  const { data: me } = useMe();
  return (
    <Screen>
      <Header title={t('profile.employment')} />
      {!me ? <Skeleton className="h-96" /> : <EmploymentForm me={me} onDone={() => router.back()} />}
    </Screen>
  );
}
