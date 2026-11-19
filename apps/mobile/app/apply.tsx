import { calculateQuote } from '@orgil/financial-engine';
import { formatMNT, formatPercent, type ApplicationDto, type QuoteDto } from '@orgil/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, CheckCircle2, Landmark, Pencil } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, View } from 'react-native';
import { AmountPicker } from '@/components/amount-picker';
import { Steps, SuccessBadge } from '@/components/finance';
import { BankAccountForm, EmploymentForm, KycUploader, PersonalForm } from '@/components/forms';
import { ProductArt } from '@/components/product-art';
import { QuoteView } from '@/components/quote-view';
import { Button, Card, Chip, ErrorView, haptic, Header, Notice, Row, Screen, Skeleton, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { qk, useBankAccounts, useMe, useProducts } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

const STEP_KEYS = ['product', 'amount', 'term', 'personal', 'identity', 'employment', 'bank', 'review', 'agreement', 'submit'] as const;
type StepKey = (typeof STEP_KEYS)[number];

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable onPress={() => { haptic.tap(); onChange(!checked); }} className="mb-3 flex-row items-start gap-3">
      <View className={`mt-0.5 h-6 w-6 items-center justify-center rounded-lg border-2 ${checked ? 'border-brand bg-brand' : 'border-line dark:border-line-dark'}`}>{checked && <Check size={14} color="#fff" />}</View>
      <Text className="flex-1 text-[14px] leading-[20px] text-ink dark:text-ink-inverse">{label}</Text>
    </Pressable>
  );
}

function Summary({ title, lines, onEdit }: { title: string; lines: string[]; onEdit: () => void }) {
  const { c } = useTheme();
  return (
    <Card className="mb-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2"><CheckCircle2 size={18} color="#14936B" /><Text variant="bodyStrong">{title}</Text></View>
        <Pressable onPress={onEdit} hitSlop={10} className="flex-row items-center gap-1"><Pencil size={14} color={c.primary} /><Text className="text-[13px] text-brand">Засах</Text></Pressable>
      </View>
      {lines.map((l) => <Text key={l} variant="caption" className="mt-1.5">{l}</Text>)}
    </Card>
  );
}

export default function Apply() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ productId?: string; amount?: string; term?: string }>();
  const { data: products } = useProducts();
  const { data: me } = useMe();
  const { data: accounts } = useBankAccounts();
  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState<string | undefined>(params.productId);
  const [amount, setAmount] = useState(Number(params.amount) || 0);
  const [term, setTerm] = useState(Number(params.term) || 0);
  const [bankId, setBankId] = useState<string>();
  const [editing, setEditing] = useState<Partial<Record<StepKey, boolean>>>({});
  const [addingBank, setAddingBank] = useState(false);
  const [preview, setPreview] = useState<{ quote: QuoteDto; contract: { body: string; contentHash: string; templateVersion: string } } | null>(null);
  const [accept, setAccept] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<ApplicationDto | null>(null);
  const scroll = useRef<ScrollView>(null);
  const fade = useRef(new Animated.Value(1)).current;

  const product = products?.find((p) => p.id === productId);
  const key = STEP_KEYS[step];
  const p = me?.profile;
  const personalDone = Boolean(p?.firstName && p.registerNumberMasked && p.dateOfBirth && p.address);
  const employmentDone = Boolean(p?.employerName && p.monthlyIncome && p.employmentStartDate);

  useEffect(() => {
    if (!product) return;
    const min = Number(product.minAmount), max = Number(product.maxAmount), stepAmt = Number(product.amountStep);
    if (!amount || amount < min || amount > max) setAmount(Math.min(max, Math.max(min, Math.round((Math.min(max, 2_000_000) - min) / stepAmt) * stepAmt + min)));
    if (!product.allowedTerms.includes(term)) setTerm(product.allowedTerms.includes(12) ? 12 : product.allowedTerms[0]);
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!bankId && accounts?.length) setBankId((accounts.find((a) => a.isPrimary) ?? accounts[0]).id);
  }, [accounts, bankId]);

  const estimate = useMemo(() => {
    try { return product && amount && term ? calculateQuote({ ...product, principal: String(amount), termMonths: term }) : null; } catch { return null; }
  }, [product, amount, term]);

  const go = (to: number) => {
    setError(null);
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    setTimeout(() => { setStep(to); scroll.current?.scrollTo({ y: 0, animated: false }); }, 120);
  };
  const next = () => go(Math.min(step + 1, STEP_KEYS.length - 1));
  const back = () => (step === 0 ? router.back() : go(step - 1));

  async function loadPreview() {
    setLoading(true); setError(null);
    try {
      const r = await api<NonNullable<typeof preview>>('/applications/preview', { body: { productId, amount: `${amount}.00`, termMonths: term, bankAccountId: bankId } });
      setPreview(r);
      next();
    } catch (e) { setError(e); haptic.error(); } finally { setLoading(false); }
  }

  async function submit() {
    if (!preview) return;
    setLoading(true); setError(null);
    try {
      const app = await api<ApplicationDto>('/applications', {
        body: { productId, amount: `${amount}.00`, termMonths: term, bankAccountId: bankId, contractHash: preview.contract.contentHash, acceptTerms: accept, consentDataProcessing: consent },
      });
      haptic.success();
      setSubmitted(app);
      await Promise.all([qc.invalidateQueries({ queryKey: qk.dashboard }), qc.invalidateQueries({ queryKey: qk.applications })]);
    } catch (e) {
      setError(e); haptic.error();
      if ((e as { code?: string }).code === 'CONTRACT_CHANGED') setPreview(null);
    } finally { setLoading(false); }
  }

  if (submitted) {
    return (
      <Screen className="flex-1 justify-center">
        <View className="mt-24 items-center">
          <SuccessBadge />
          <Text variant="h1" className="mt-8 text-center">{t('apply.submittedTitle')}</Text>
          <Text variant="body" className="mt-3 text-center text-ink-muted">{t('apply.submittedBody')}</Text>
          <Text variant="micro" className="mt-4">{submitted.applicationNo}</Text>
        </View>
        <Button title={t('apply.viewStatus')} className="mt-12" onPress={() => router.replace(`/applications/${submitted.id}`)} />
        <Button title={t('apply.goHome')} variant="ghost" className="mt-2" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  const stepTitle = t(`apply.steps.${key}` as never);
  return (
    <Screen>
      <Header title={t('apply.title')} />
      <Steps step={step + 1} total={STEP_KEYS.length} label={stepTitle} />
      <Animated.View style={{ opacity: fade }}>
        {!products || !me ? <Skeleton className="h-80" /> : (
          <>
            {key === 'product' && (
              <View>
                <Text variant="h2" className="mb-4">{t('apply.selectProduct')}</Text>
                {products.map((pr) => (
                  <Card key={pr.id} onPress={() => setProductId(pr.id)} className={`mb-3 flex-row items-center gap-4 border-2 ${pr.id === productId ? 'border-brand' : 'border-transparent'}`}>
                    <ProductArt category={pr.category} size={46} />
                    <View className="flex-1">
                      <Text variant="bodyStrong">{lang === 'en' ? pr.nameEn : pr.nameMn}</Text>
                      <Text variant="caption" className="text-[12px]">{formatMNT(pr.minAmount)} – {formatMNT(pr.maxAmount)} · {formatPercent(pr.monthlyInterestRate)}{t('common.perMonth')}</Text>
                    </View>
                    <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${pr.id === productId ? 'border-brand bg-brand' : 'border-line dark:border-line-dark'}`}>{pr.id === productId && <Check size={14} color="#fff" />}</View>
                  </Card>
                ))}
                <Button title={t('common.next')} disabled={!product} onPress={next} className="mt-2" />
              </View>
            )}

            {key === 'amount' && product && (
              <View>
                <Text variant="h2" className="mb-4">{t('apply.enterAmount')}</Text>
                <Card><AmountPicker value={amount} min={Number(product.minAmount)} max={Number(product.maxAmount)} step={Number(product.amountStep)} onChange={setAmount} /></Card>
                {me.creditLimit && amount > Number(me.creditLimit.available) && <View className="mt-4"><Notice>{t('home.limitIndicative')}</Notice></View>}
                <Button title={t('common.next')} onPress={next} className="mt-5" />
              </View>
            )}

            {key === 'term' && product && (
              <View>
                <Text variant="h2" className="mb-4">{t('apply.selectTerm')}</Text>
                <View className="mb-4 flex-row flex-wrap gap-y-2">{product.allowedTerms.map((m) => <Chip key={m} label={`${m} ${t('common.months')}`} active={m === term} onPress={() => setTerm(m)} />)}</View>
                {estimate && <QuoteView quote={estimate} feeDeducted={product.feeCollection === 'DEDUCTED_FROM_DISBURSEMENT'} />}
                <View className="mt-4"><Notice>{t('calculator.disclaimer')}</Notice></View>
                <Button title={t('common.next')} onPress={next} className="mt-5" />
              </View>
            )}

            {key === 'personal' && (personalDone && !editing.personal ? (
              <View>
                <Summary title={t('apply.steps.personal')} lines={[`${p!.lastName} ${p!.firstName}`, `${t('apply.registerNumber')}: ${p!.registerNumberMasked}`, p!.address ?? '']} onEdit={() => setEditing({ ...editing, personal: true })} />
                <Button title={t('common.next')} onPress={next} />
              </View>
            ) : <PersonalForm me={me} submitLabel={t('common.next')} onDone={() => { setEditing({ ...editing, personal: false }); next(); }} />)}

            {key === 'identity' && (
              <View>
                <Text variant="h2" className="mb-2">{t('apply.identityTitle')}</Text>
                <KycUploader submitLabel={t('common.next')} onDone={next} />
              </View>
            )}

            {key === 'employment' && (employmentDone && !editing.employment ? (
              <View>
                <Summary title={t('apply.steps.employment')} lines={[`${p!.employerName}${p!.jobTitle ? ` · ${p!.jobTitle}` : ''}`, `${t('apply.monthlyIncome')}: ${formatMNT(p!.monthlyIncome)}`, `${t('apply.obligations')}: ${formatMNT(p!.monthlyObligations ?? '0')}`]} onEdit={() => setEditing({ ...editing, employment: true })} />
                <Button title={t('common.next')} onPress={next} />
              </View>
            ) : <EmploymentForm me={me} submitLabel={t('common.next')} onDone={() => { setEditing({ ...editing, employment: false }); next(); }} />)}

            {key === 'bank' && (
              <View>
                <Text variant="h2" className="mb-4">{t('apply.bankTitle')}</Text>
                {accounts?.map((a) => (
                  <Card key={a.id} onPress={() => setBankId(a.id)} className={`mb-3 flex-row items-center gap-4 border-2 ${a.id === bankId ? 'border-brand' : 'border-transparent'}`}>
                    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft dark:bg-brand/20"><Landmark size={20} color="#FF5533" /></View>
                    <View className="flex-1"><Text variant="bodyStrong">{a.bankName}</Text><Text variant="caption" className="text-[12px]">{a.accountNumberMasked} · {a.accountHolder}</Text></View>
                    {a.id === bankId && <CheckCircle2 size={22} color="#FF5533" />}
                  </Card>
                ))}
                {addingBank || !accounts?.length ? (
                  <Card className="mt-1"><BankAccountForm defaultHolder={[p?.lastName, p?.firstName].filter(Boolean).join(' ')} onDone={(acc) => { setBankId(acc.id); setAddingBank(false); }} /></Card>
                ) : (
                  <Button title={`+ ${t('apply.addAccount')}`} variant="outline" size="md" onPress={() => setAddingBank(true)} />
                )}
                {error ? <ErrorView error={error} /> : null}
                <Button title={t('common.next')} disabled={!bankId} loading={loading} onPress={loadPreview} className="mt-5" />
              </View>
            )}

            {key === 'review' && preview && product && (
              <View>
                <Text variant="h2" className="mb-4">{t('apply.reviewTitle')}</Text>
                <Card className="mb-4">
                  <Row label={t('calculator.product')} value={lang === 'en' ? product.nameEn : product.nameMn} />
                  <Row label={t('calculator.term')} value={`${term} ${t('common.months')}`} />
                  <Row label={t('products.interest')} value={formatPercent(preview.quote.monthlyInterestRate)} />
                  <Row label={t('apply.bankTitle')} value={accounts?.find((a) => a.id === bankId)?.accountNumberMasked ?? ''} />
                </Card>
                <QuoteView quote={preview.quote} feeDeducted={product.feeCollection === 'DEDUCTED_FROM_DISBURSEMENT'} />
                <Button title={t('common.next')} onPress={next} className="mt-5" />
              </View>
            )}

            {key === 'agreement' && preview && (
              <View>
                <Text variant="h2" className="mb-4">{t('apply.agreementTitle')}</Text>
                <Card className="mb-4 max-h-[380px] p-0">
                  <ScrollView nestedScrollEnabled className="p-5"><Text className="pb-8 text-[13px] leading-[20px] text-ink dark:text-ink-inverse">{preview.contract.body}</Text></ScrollView>
                </Card>
                <Checkbox checked={accept} onChange={setAccept} label={t('apply.agreementAccept')} />
                <Checkbox checked={consent} onChange={setConsent} label={t('apply.consentData')} />
                <Button title={t('common.next')} disabled={!accept || !consent} onPress={next} className="mt-3" />
              </View>
            )}

            {key === 'submit' && preview && (
              <View>
                <Card className="items-center">
                  <Text variant="caption">{t('calculator.amount')}</Text>
                  <Text className="mt-1 font-display text-[34px] text-ink dark:text-ink-inverse">{formatMNT(preview.quote.principal)}</Text>
                  <Text variant="caption" className="mt-1">{term} {t('common.months')} · {formatMNT(preview.quote.monthlyPayment)}{t('common.perMonth')}</Text>
                </Card>
                <View className="mt-4"><Notice tone="info">{t('apply.submittedBody')}</Notice></View>
                {error ? <ErrorView error={error} /> : null}
                <Button title={t('apply.submit')} loading={loading} onPress={submit} className="mt-5" />
              </View>
            )}

            {(key === 'review' || key === 'agreement' || key === 'submit') && !preview && (
              <View><ErrorView error={error ?? new Error(t('common.error'))} /><Button title={t('common.back')} variant="outline" onPress={() => go(STEP_KEYS.indexOf('bank'))} /></View>
            )}
            {step > 0 && <Button title={t('common.back')} variant="ghost" onPress={back} className="mt-2" />}
          </>
        )}
      </Animated.View>
    </Screen>
  );
}
