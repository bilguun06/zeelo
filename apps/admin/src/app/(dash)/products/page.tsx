'use client';
import { calculateQuote } from '@orgil/financial-engine';
import { formatMNT, formatPercent, type LoanProductDto } from '@orgil/shared';
import { Eye, EyeOff, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Can } from '@/components/admin-context';
import { Button } from '@/components/ui/button';
import { Badge, Card, Dialog, ErrorBox, Field, Input, Notice, PageHeader, Select, Skeleton, StatusBadge, Switch, Textarea } from '@/components/ui/primitives';
import { api, useApi } from '@/lib/api';
import { CATEGORY_LABEL } from '@/lib/utils';

type Product = LoanProductDto & { sortOrder: number; loans: number; applications: number };
type Form = Omit<LoanProductDto, 'id' | 'allowedTerms'> & { allowedTerms: string; sortOrder: number };

const EMPTY: Form = {
  code: '', category: 'CONSUMER', nameMn: '', nameEn: '', descriptionMn: '', descriptionEn: '', minAmount: '100000', maxAmount: '1000000', amountStep: '10000',
  allowedTerms: '3, 6, 12', monthlyInterestRate: '0', serviceFeePercent: '0', serviceFeeFixed: '0', feeCollection: 'DEDUCTED_FROM_DISBURSEMENT', repaymentMethod: 'ANNUITY',
  penaltyRateDaily: '0', eligibility: { requiresKyc: true, minAgeYears: 18 }, status: 'DRAFT', isAuthorized: false, sortOrder: 10,
};
const METHOD: Record<string, string> = { ANNUITY: 'Тэнцүү төлөлт', EQUAL_PRINCIPAL: 'Үндсэн зээл тэнцүү', BULLET: 'Хугацааны эцэст' };

function toForm(p: Product): Form {
  const { id: _id, loans: _l, applications: _a, ...rest } = p;
  return { ...rest, allowedTerms: p.allowedTerms.join(', ') };
}

export default function ProductsPage() {
  const { data, error, mutate } = useApi<Product[]>('products');
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));
  const setElig = (k: string, v: unknown) => setEditing((e) => (e ? { ...e, form: { ...e.form, eligibility: { ...e.form.eligibility, [k]: v === '' ? undefined : v } } } : e));

  const terms = editing ? editing.form.allowedTerms.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  const preview = useMemo(() => {
    if (!editing || !terms.length) return null;
    try {
      const f = editing.form;
      return calculateQuote({ ...f, principal: f.maxAmount, termMonths: Math.max(...terms) });
    } catch (e) {
      return (e as Error).message;
    }
  }, [editing, terms]);

  async function save() {
    if (!editing) return;
    setBusy(true); setErr(null);
    const { allowedTerms: _t, ...f } = editing.form;
    const body = { ...f, allowedTerms: terms, eligibility: Object.fromEntries(Object.entries(f.eligibility).filter(([, v]) => v !== undefined && v !== '')) };
    try {
      await api(editing.id ? `products/${editing.id}` : 'products', { method: editing.id ? 'PUT' : 'POST', body });
      await mutate();
      setEditing(null);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Зээлийн бүтээгдэхүүн"
        subtitle="Хүү, шимтгэл, хязгаар бүгд энд тохируулагдана. Харилцагчид зөвхөн «Идэвхтэй» + «Зөвшөөрөгдсөн» бүтээгдэхүүнийг харна."
        actions={<Can perm="products.write"><Button onClick={() => { setErr(null); setEditing({ id: null, form: EMPTY }); }}><Plus className="h-4 w-4" /> Шинэ бүтээгдэхүүн</Button></Can>}
      />
      <ErrorBox error={error} />
      {!data ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => {
            const visible = p.status === 'ACTIVE' && p.isAuthorized;
            return (
              <Card key={p.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{CATEGORY_LABEL[p.category]} · {p.code}</div>
                    <h3 className="mt-1 font-display text-lg font-bold">{p.nameMn}</h3>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{p.descriptionMn}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-ink-muted">Дүн</div><div className="tabular font-semibold">{formatMNT(p.minAmount)} – {formatMNT(p.maxAmount)}</div></div>
                  <div><div className="text-xs text-ink-muted">Хугацаа</div><div className="font-semibold">{p.allowedTerms.join(', ')} сар</div></div>
                  <div><div className="text-xs text-ink-muted">Сарын хүү</div><div className="font-semibold">{formatPercent(p.monthlyInterestRate)}</div></div>
                  <div><div className="text-xs text-ink-muted">Шимтгэл</div><div className="font-semibold">{formatPercent(p.serviceFeePercent)}{Number(p.serviceFeeFixed) > 0 && ` + ${formatMNT(p.serviceFeeFixed)}`}</div></div>
                </div>
                <div className="mt-auto flex items-center justify-between pt-5">
                  <Badge tone={visible ? 'success' : 'neutral'}>{visible ? <><Eye className="h-3 w-3" /> Харагдана</> : <><EyeOff className="h-3 w-3" /> Нуугдсан</>}</Badge>
                  <div className="flex items-center gap-2 text-xs text-ink-muted">{p.loans} зээл
                    <Can perm="products.write"><Button size="sm" variant="outline" onClick={() => { setErr(null); setEditing({ id: p.id, form: toForm(p) }); }}><Pencil className="h-3.5 w-3.5" /> Засах</Button></Can>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Бүтээгдэхүүн засах' : 'Шинэ бүтээгдэхүүн'}
        wide
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Болих</Button><Button loading={busy} onClick={save}>Хадгалах</Button></>}
      >
        {editing && (
          <div className="space-y-5">
            <Notice>Хүү, шимтгэлийн өөрчлөлт зөвхөн <b>шинэ</b> хүсэлтэд үйлчилнэ. Илгээсэн хүсэлт, олгосон зээл анхны нөхцөлөөрөө үлдэнэ. Бодит тарифыг байгууллагын эрх бүхий нэгжээр батлуулсан байх ёстой.</Notice>
            <ErrorBox error={err} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Код"><Input value={editing.form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} disabled={!!editing.id} placeholder="CONSUMER_STD" /></Field>
              <Field label="Ангилал"><Select value={editing.form.category} onChange={(e) => set('category', e.target.value as Form['category'])}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field label="Нэр (MN)"><Input value={editing.form.nameMn} onChange={(e) => set('nameMn', e.target.value)} /></Field>
              <Field label="Нэр (EN)"><Input value={editing.form.nameEn} onChange={(e) => set('nameEn', e.target.value)} /></Field>
              <Field label="Тайлбар (MN)"><Textarea value={editing.form.descriptionMn} onChange={(e) => set('descriptionMn', e.target.value)} /></Field>
              <Field label="Тайлбар (EN)"><Textarea value={editing.form.descriptionEn} onChange={(e) => set('descriptionEn', e.target.value)} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Доод дүн (₮)"><Input inputMode="decimal" value={editing.form.minAmount} onChange={(e) => set('minAmount', e.target.value)} /></Field>
              <Field label="Дээд дүн (₮)"><Input inputMode="decimal" value={editing.form.maxAmount} onChange={(e) => set('maxAmount', e.target.value)} /></Field>
              <Field label="Алхам (₮)"><Input inputMode="decimal" value={editing.form.amountStep} onChange={(e) => set('amountStep', e.target.value)} /></Field>
              <Field label="Хугацаа (сар, таслалаар)"><Input value={editing.form.allowedTerms} onChange={(e) => set('allowedTerms', e.target.value)} /></Field>
              <Field label="Сарын хүү (%)"><Input inputMode="decimal" value={editing.form.monthlyInterestRate} onChange={(e) => set('monthlyInterestRate', e.target.value)} /></Field>
              <Field label="Алданги, өдрийн (%)"><Input inputMode="decimal" value={editing.form.penaltyRateDaily} onChange={(e) => set('penaltyRateDaily', e.target.value)} /></Field>
              <Field label="Шимтгэл (%)"><Input inputMode="decimal" value={editing.form.serviceFeePercent} onChange={(e) => set('serviceFeePercent', e.target.value)} /></Field>
              <Field label="Шимтгэл, тогтмол (₮)"><Input inputMode="decimal" value={editing.form.serviceFeeFixed} onChange={(e) => set('serviceFeeFixed', e.target.value)} /></Field>
              <Field label="Шимтгэл авах"><Select value={editing.form.feeCollection} onChange={(e) => set('feeCollection', e.target.value as Form['feeCollection'])}><option value="DEDUCTED_FROM_DISBURSEMENT">Олголтоос суутгах</option><option value="ADDED_TO_FIRST_INSTALLMENT">Эхний төлөлтөд нэмэх</option></Select></Field>
              <Field label="Төлөлтийн арга"><Select value={editing.form.repaymentMethod} onChange={(e) => set('repaymentMethod', e.target.value as Form['repaymentMethod'])}>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field label="Төлөв"><Select value={editing.form.status} onChange={(e) => set('status', e.target.value as Form['status'])}><option value="DRAFT">Ноорог</option><option value="ACTIVE">Идэвхтэй</option><option value="PAUSED">Түр зогсоосон</option><option value="ARCHIVED">Архивласан</option></Select></Field>
              <Field label="Эрэмбэ"><Input type="number" value={editing.form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></Field>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Шаардлага</h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Доод орлого (₮)"><Input value={editing.form.eligibility.minMonthlyIncome ?? ''} onChange={(e) => setElig('minMonthlyIncome', e.target.value)} /></Field>
                <Field label="Доод нас"><Input type="number" value={editing.form.eligibility.minAgeYears ?? ''} onChange={(e) => setElig('minAgeYears', e.target.value ? Number(e.target.value) : '')} /></Field>
                <Field label="Ажилласан хугацаа (сар)"><Input type="number" value={editing.form.eligibility.minEmploymentMonths ?? ''} onChange={(e) => setElig('minEmploymentMonths', e.target.value ? Number(e.target.value) : '')} /></Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-6">
                <Switch checked={!!editing.form.eligibility.requiresKyc} onChange={(v) => setElig('requiresKyc', v)} label="Иргэний үнэмлэх баталгаажуулалт шаардлагатай" />
                <Switch checked={editing.form.isAuthorized} onChange={(v) => set('isAuthorized', v)} label="Хууль эрх зүйн зөвшөөрөлтэй (харилцагчид харуулах)" />
              </div>
            </div>
            <div className="rounded-xl2 bg-navy p-4 text-sm text-white">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-mint">Урьдчилсан тооцоо — дээд дүн, хамгийн урт хугацаа</div>
              {typeof preview === 'string' ? <span className="text-danger">{preview}</span> : preview ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><div className="text-xs text-white/60">Сарын төлөлт</div><div className="tabular font-bold">{formatMNT(preview.monthlyPayment)}</div></div>
                  <div><div className="text-xs text-white/60">Нийт хүү</div><div className="tabular font-bold">{formatMNT(preview.totalInterest)}</div></div>
                  <div><div className="text-xs text-white/60">Олгох дүн</div><div className="tabular font-bold">{formatMNT(preview.netDisbursement)}</div></div>
                  <div><div className="text-xs text-white/60">APR</div><div className="tabular font-bold">{formatPercent(preview.apr)}</div></div>
                </div>
              ) : <span className="text-white/60">Хугацаа оруулна уу</span>}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
