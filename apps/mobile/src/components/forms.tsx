import { MONGOLIAN_BANKS, type BankAccountDto, type EmploymentType, type MeDto } from '@orgil/shared';
import { bankAccountSchema, employmentSchema, personalInfoSchema } from '@orgil/validation';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, ImageIcon, Landmark } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { api } from '@/lib/api';
import { useErrorText, useI18n } from '@/lib/i18n';
import { qk, useKyc } from '@/lib/queries';
import { useTheme } from '@/lib/theme';
import { Button, Chip, ErrorView, haptic, Input, Notice, Text } from './ui';

type Errors = Record<string, string | undefined>;
const toErrors = (issues: { path: (string | number)[]; message: string }[], tr: (k?: string) => string | undefined): Errors =>
  Object.fromEntries(issues.map((i) => [String(i.path[0]), tr(i.message)]));
const digits = (v: string) => v.replace(/[^\d.]/g, '');

export function PersonalForm({ me, onDone, submitLabel }: { me?: MeDto; onDone: () => void; submitLabel?: string }) {
  const { t } = useI18n();
  const tr = useErrorText();
  const qc = useQueryClient();
  const p = me?.profile;
  const [f, setF] = useState({ lastName: p?.lastName ?? '', firstName: p?.firstName ?? '', registerNumber: '', dateOfBirth: p?.dateOfBirth?.slice(0, 10) ?? '', email: p?.email ?? '', address: p?.address ?? '' });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  async function submit() {
    const parsed = personalInfoSchema.safeParse(f);
    if (!parsed.success) { setErrors(toErrors(parsed.error.issues, tr)); haptic.error(); return; }
    setErrors({}); setError(null); setLoading(true);
    try {
      await api('/me/profile/personal', { method: 'PUT', body: { ...parsed.data, email: parsed.data.email || undefined } });
      await qc.invalidateQueries({ queryKey: qk.me });
      onDone();
    } catch (e) { setError(e); haptic.error(); } finally { setLoading(false); }
  }

  return (
    <View>
      <Input label={t('apply.lastName')} value={f.lastName} onChangeText={set('lastName')} error={errors.lastName} />
      <Input label={t('apply.firstName')} value={f.firstName} onChangeText={set('firstName')} error={errors.firstName} />
      <Input label={t('apply.registerNumber')} placeholder={p?.registerNumberMasked ?? t('apply.registerHint')} autoCapitalize="characters" maxLength={10} value={f.registerNumber} onChangeText={(v) => set('registerNumber')(v.toUpperCase())} error={errors.registerNumber} hint={t('apply.registerHint')} />
      <Input label={t('apply.dateOfBirth')} placeholder="1995-04-12" keyboardType="numbers-and-punctuation" maxLength={10} value={f.dateOfBirth} onChangeText={set('dateOfBirth')} error={errors.dateOfBirth} />
      <Input label={t('apply.email')} keyboardType="email-address" autoCapitalize="none" value={f.email} onChangeText={set('email')} error={errors.email} />
      <Input label={t('apply.address')} value={f.address} onChangeText={set('address')} error={errors.address} />
      {error ? <ErrorView error={error} /> : null}
      <Button title={submitLabel ?? t('common.save')} onPress={submit} loading={loading} />
    </View>
  );
}

const EMPLOYMENT_TYPES: EmploymentType[] = ['FULL_TIME', 'PART_TIME', 'SELF_EMPLOYED', 'CONTRACT', 'PENSIONER', 'OTHER'];

export function EmploymentForm({ me, onDone, submitLabel }: { me?: MeDto; onDone: () => void; submitLabel?: string }) {
  const { t } = useI18n();
  const tr = useErrorText();
  const qc = useQueryClient();
  const p = me?.profile;
  const [f, setF] = useState({
    employerName: p?.employerName ?? '', employmentType: (p?.employmentType ?? 'FULL_TIME') as EmploymentType, jobTitle: p?.jobTitle ?? '',
    monthlyIncome: p?.monthlyIncome ? String(Number(p.monthlyIncome)) : '', monthlyObligations: p?.monthlyObligations ? String(Number(p.monthlyObligations)) : '0',
    employmentStartDate: p?.employmentStartDate?.slice(0, 10) ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const parsed = employmentSchema.safeParse(f);
    if (!parsed.success) { setErrors(toErrors(parsed.error.issues, tr)); haptic.error(); return; }
    setErrors({}); setError(null); setLoading(true);
    try {
      await api('/me/profile/employment', { method: 'PUT', body: { ...parsed.data, jobTitle: parsed.data.jobTitle || undefined } });
      await qc.invalidateQueries({ queryKey: qk.me });
      await qc.invalidateQueries({ queryKey: qk.dashboard });
      onDone();
    } catch (e) { setError(e); haptic.error(); } finally { setLoading(false); }
  }

  return (
    <View>
      <Input label={t('apply.employer')} value={f.employerName} onChangeText={(v) => setF({ ...f, employerName: v })} error={errors.employerName} />
      <Text variant="label" className="mb-2">{t('apply.employmentType')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 mb-4">
        {EMPLOYMENT_TYPES.map((et) => <Chip key={et} label={t(`apply.employmentTypes.${et}` as never)} active={f.employmentType === et} onPress={() => setF({ ...f, employmentType: et })} />)}
      </ScrollView>
      <Input label={t('apply.jobTitle')} value={f.jobTitle} onChangeText={(v) => setF({ ...f, jobTitle: v })} />
      <Input label={`${t('apply.monthlyIncome')} (₮)`} keyboardType="numeric" value={f.monthlyIncome} onChangeText={(v) => setF({ ...f, monthlyIncome: digits(v) })} error={errors.monthlyIncome} />
      <Input label={`${t('apply.obligations')} (₮)`} keyboardType="numeric" value={f.monthlyObligations} onChangeText={(v) => setF({ ...f, monthlyObligations: digits(v) })} error={errors.monthlyObligations} />
      <Input label={t('apply.employmentStart')} placeholder="2021-03-01" keyboardType="numbers-and-punctuation" maxLength={10} value={f.employmentStartDate} onChangeText={(v) => setF({ ...f, employmentStartDate: v })} error={errors.employmentStartDate} />
      {error ? <ErrorView error={error} /> : null}
      <Button title={submitLabel ?? t('common.save')} onPress={submit} loading={loading} />
    </View>
  );
}

export function BankAccountForm({ onDone, defaultHolder }: { onDone: (acc: BankAccountDto) => void; defaultHolder?: string }) {
  const { t, lang } = useI18n();
  const tr = useErrorText();
  const qc = useQueryClient();
  const [f, setF] = useState({ bankCode: 'KHAN', accountNumber: '', accountHolder: defaultHolder ?? '' });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const parsed = bankAccountSchema.safeParse(f);
    if (!parsed.success) { setErrors(toErrors(parsed.error.issues, tr)); haptic.error(); return; }
    setErrors({}); setError(null); setLoading(true);
    try {
      const acc = await api<BankAccountDto>('/me/bank-accounts', { body: parsed.data });
      await qc.invalidateQueries({ queryKey: qk.bankAccounts });
      onDone(acc);
    } catch (e) { setError(e); haptic.error(); } finally { setLoading(false); }
  }

  return (
    <View>
      <Text variant="label" className="mb-2">{t('apply.selectBank')}</Text>
      <View className="mb-4 flex-row flex-wrap gap-y-2">
        {MONGOLIAN_BANKS.map((b) => <Chip key={b.code} label={lang === 'en' ? b.nameEn : b.nameMn} active={f.bankCode === b.code} onPress={() => setF({ ...f, bankCode: b.code })} />)}
      </View>
      <Input label={t('apply.accountNumber')} keyboardType="number-pad" maxLength={16} value={f.accountNumber} onChangeText={(v) => setF({ ...f, accountNumber: v.replace(/\D/g, '') })} error={errors.accountNumber} />
      <Input label={t('apply.accountHolder')} value={f.accountHolder} onChangeText={(v) => setF({ ...f, accountHolder: v })} error={errors.accountHolder} />
      {error ? <ErrorView error={error} /> : null}
      <Button title={t('apply.addAccount')} variant="secondary" icon={<Landmark size={18} color="#FF5533" />} onPress={submit} loading={loading} />
    </View>
  );
}

const DOCS = ['ID_FRONT', 'ID_BACK', 'SELFIE'] as const;
const DOC_LABEL = { ID_FRONT: 'apply.idFront', ID_BACK: 'apply.idBack', SELFIE: 'apply.selfie' } as const;

/** Captures ID front/back + selfie and uploads them (server verifies file type by magic bytes and encrypts at rest). */
export function KycUploader({ onDone, submitLabel }: { onDone: () => void; submitLabel?: string }) {
  const { t } = useI18n();
  const { c } = useTheme();
  const qc = useQueryClient();
  const kyc = useKyc();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const uploaded = (type: string) => kyc.data?.documents.find((d) => d.type === type)?.uploaded;
  const verified = kyc.data?.status === 'VERIFIED' || kyc.data?.status === 'PENDING';

  async function pick(type: (typeof DOCS)[number], source: 'camera' | 'library') {
    setError(null);
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: type !== 'SELFIE', cameraType: type === 'SELFIE' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back };
    const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets[0]) return;
    const asset = r.assets[0];
    setBusy(type);
    try {
      const fd = new FormData();
      fd.append('type', type);
      if (Platform.OS === 'web') fd.append('file', asset.file ?? (await (await fetch(asset.uri)).blob()), `${type}.jpg`);
      else fd.append('file', { uri: asset.uri, name: `${type}.jpg`, type: asset.mimeType ?? 'image/jpeg' } as unknown as Blob);
      await api('/kyc/documents', { body: fd });
      haptic.success();
      await qc.invalidateQueries({ queryKey: qk.kyc });
    } catch (e) { setError(e); haptic.error(); } finally { setBusy(null); }
  }

  const choose = (type: (typeof DOCS)[number]) => {
    if (Platform.OS === 'web') return void pick(type, 'library');
    Alert.alert(t(DOC_LABEL[type]), undefined, [
      { text: t('apply.takePhoto'), onPress: () => void pick(type, 'camera') },
      { text: t('apply.fromGallery'), onPress: () => void pick(type, 'library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  async function submit() {
    setSubmitting(true); setError(null);
    try {
      if (!verified) await api('/kyc/submit', { method: 'POST' });
      await qc.invalidateQueries({ queryKey: qk.kyc });
      await qc.invalidateQueries({ queryKey: qk.me });
      onDone();
    } catch (e) { setError(e); haptic.error(); } finally { setSubmitting(false); }
  }

  if (verified) {
    return (
      <View>
        <Notice tone="info">{t('profile.idVerification')}: {t(`profile.kyc.${kyc.data!.status}` as never)}</Notice>
        <Button title={submitLabel ?? t('common.continue')} onPress={onDone} className="mt-5" />
      </View>
    );
  }

  return (
    <View>
      <Text variant="body" className="mb-4 text-ink-muted">{t('apply.identityBody')}</Text>
      {DOCS.map((type) => {
        const done = uploaded(type);
        return (
          <Pressable key={type} onPress={() => choose(type)} disabled={!!busy} className={`mb-3 flex-row items-center gap-4 rounded-[22px] border-2 border-dashed p-4 ${done ? 'border-mint bg-mint-soft dark:bg-mint/10' : 'border-line dark:border-line-dark'}`}>
            <View className={`h-12 w-12 items-center justify-center rounded-2xl ${done ? 'bg-mint' : 'bg-surface-alt dark:bg-surface-altdark'}`}>
              {busy === type ? <ActivityIndicator color={c.primary} /> : done ? <Check size={22} color="#14161F" /> : type === 'SELFIE' ? <Camera size={22} color={c.primary} /> : <ImageIcon size={22} color={c.primary} />}
            </View>
            <View className="flex-1">
              <Text variant="bodyStrong">{t(DOC_LABEL[type])}</Text>
              <Text variant="caption" className="text-[12px]">{done ? t('apply.uploaded') : t('apply.upload')}</Text>
            </View>
          </Pressable>
        );
      })}
      {error ? <ErrorView error={error} /> : null}
      <Button title={submitLabel ?? t('common.continue')} onPress={submit} loading={submitting} disabled={!DOCS.every(uploaded)} className="mt-2" />
    </View>
  );
}
