'use client';
import { formatDate, formatDateTime, formatMNT, formatPercent, type CreditAssessmentDto, type QuoteDto } from '@orgil/shared';
import { AlertTriangle, ArrowLeft, Banknote, Check, CheckCircle2, FileText, MessageSquare, RefreshCw, ShieldAlert, ShieldCheck, X, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Can, useAdmin } from '@/components/admin-context';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, Dialog, ErrorBox, Field, Input, Notice, PageHeader, Skeleton, StatusBadge, Textarea } from '@/components/ui/primitives';
import { api, useApi } from '@/lib/api';
import { STATUS_LABEL, cn } from '@/lib/utils';

interface Detail {
  id: string; applicationNo: string; status: string; amount: string; termMonths: number; purpose: string | null; submittedAt: string | null; decisionReason: string | null; infoRequest: string | null;
  product: { id: string; nameMn: string; code: string };
  applicant: { userId: string; phone: string; kycStatus: string; snapshot: Record<string, string | null> };
  documents: { id: string; type: string; status: string; mimeType: string; createdAt: string }[];
  bankAccount: { bankName: string; accountNumberMasked: string; accountHolder: string } | null;
  terms: { monthlyInterestRate: string; serviceFeePercent: string; repaymentMethod: string };
  quote: QuoteDto;
  contract: { templateVersion: string; contentHash: string; acceptedAt: string | null; acceptedIp: string | null; body: string } | null;
  assessments: CreditAssessmentDto[];
  history: { from: string | null; to: string; actorType: string; note: string | null; at: string }[];
  notes: { id: string; body: string; admin: string; at: string }[];
  approvals: { decision: string; reason: string; admin: string; at: string }[];
  loan: { id: string; loanNo: string } | null;
}
type Action = 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
const DOC_LABEL: Record<string, string> = { ID_FRONT: 'Үнэмлэх (урд)', ID_BACK: 'Үнэмлэх (ар)', SELFIE: 'Нүүрний зураг', INCOME_PROOF: 'Орлогын баталгаа', OTHER: 'Бусад' };

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4 border-b border-line/60 py-2 text-sm last:border-0 dark:border-line-dark/60"><span className="text-ink-muted">{k}</span><span className="tabular text-right font-medium">{v}</span></div>;
}

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAdmin();
  const { data: d, error, mutate } = useApi<Detail>(`applications/${id}`);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [payoutRef, setPayoutRef] = useState('');
  const [contractOpen, setContractOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true); setErr(null);
    try { await fn(); await mutate(); after?.(); } catch (e) { setErr(e); } finally { setBusy(false); }
  }

  if (error) return <ErrorBox error={error} />;
  if (!d) return <div className="space-y-4"><Skeleton className="h-10 w-80" /><Skeleton className="h-96" /></div>;

  const a = d.assessments[0];
  const decidable = ['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(d.status);
  const approver = d.approvals.find((x) => x.decision === 'APPROVED');
  const s = d.applicant.snapshot;

  return (
    <div className="animate-rise">
      <Link href="/applications" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Хүсэлтүүд</Link>
      <PageHeader
        title={d.applicationNo}
        subtitle={`${s.lastName ?? ''} ${s.firstName ?? ''} · ${d.applicant.phone} · ${d.product.nameMn}`}
        actions={
          <>
            <StatusBadge status={d.status} />
            {decidable && (
              <Can perm="applications.decide">
                <Button variant="outline" onClick={() => { setAction('REQUEST_INFO'); setReason(''); }}><MessageSquare className="h-4 w-4" /> Мэдээлэл хүсэх</Button>
                <Button variant="danger" onClick={() => { setAction('REJECT'); setReason(''); }}><X className="h-4 w-4" /> Татгалзах</Button>
                <Button variant="success" onClick={() => { setAction('APPROVE'); setReason(''); }} disabled={d.status === 'INFO_REQUESTED'}><Check className="h-4 w-4" /> Зөвшөөрөх</Button>
              </Can>
            )}
            {d.status === 'APPROVED' && <Can perm="loans.disburse"><Button onClick={() => setDisburseOpen(true)}><Banknote className="h-4 w-4" /> Олголт бүртгэх</Button></Can>}
            {d.loan && <Link href={`/loans/${d.loan.id}`}><Button variant="outline">{d.loan.loanNo}</Button></Link>}
          </>
        }
      />
      <ErrorBox error={err} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* AI assessment */}
          <Card>
            <CardHeader
              title="Зээлийн эрсдэлийн үнэлгээ"
              subtitle={a ? `${a.modelVersion} · ${formatDateTime(a.createdAt)}` : 'Үнэлгээ хийгдээгүй'}
              action={<Can perm="applications.decide"><Button size="sm" variant="ghost" loading={busy} onClick={() => run(() => api(`applications/${id}/rescore`, { method: 'POST' }))}><RefreshCw className="h-3.5 w-3.5" /> Дахин үнэлэх</Button></Can>}
            />
            <CardBody className="space-y-5">
              <Notice>Энэ үнэлгээ нь шийдвэр гаргахад туслах зөвлөмж бөгөөд зээлийн мэдээллийн сангийн өгөгдөл одоогоор <b>СИМУЛЯЦИ</b> байна. Хүйс, үндэс угсаа, шашин, гэрлэлтийн байдал, хаяг зэрэг мэдээллийг загварт ашигладаггүй.</Notice>
              {a && (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-xl2 bg-navy p-4 text-white"><div className="text-xs text-white/60">Оноо</div><div className="font-display text-3xl font-extrabold">{a.score}</div><div className="text-xs text-white/60">300–850</div></div>
                    <div className="rounded-xl2 bg-surface-alt p-4 dark:bg-surface-altdark"><div className="text-xs text-ink-muted">Зэрэглэл</div><div className="font-display text-3xl font-extrabold">{a.riskGrade}</div><div className="text-xs text-ink-muted">PD {formatPercent(Number(a.probabilityOfDefault) * 100, 1)}</div></div>
                    <div className="rounded-xl2 bg-surface-alt p-4 dark:bg-surface-altdark"><div className="text-xs text-ink-muted">Өр/орлого (DTI)</div><div className="font-display text-3xl font-extrabold">{formatPercent(Number(a.debtToIncome) * 100, 0)}</div><div className="text-xs text-ink-muted">шинэ зээлийг оруулаад</div></div>
                    <div className="rounded-xl2 bg-surface-alt p-4 dark:bg-surface-altdark"><div className="text-xs text-ink-muted">Зөвлөмж</div><Badge className="mt-2" tone={a.recommendation === 'APPROVE_RECOMMENDED' ? 'success' : a.recommendation === 'DECLINE_RECOMMENDED' ? 'danger' : 'warning'}>{STATUS_LABEL[a.recommendation]}</Badge></div>
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Шийдвэрт нөлөөлсөн хүчин зүйлс</h4>
                    <div className="divide-y divide-line/60 dark:divide-line-dark/60">
                      {a.factors.map((f) => (
                        <div key={f.key} className="flex items-center justify-between gap-4 py-2.5">
                          <div><div className="text-sm font-medium">{f.labelMn}</div><div className="text-xs text-ink-muted">{f.detail}</div></div>
                          <span className={cn('tabular rounded-lg px-2 py-0.5 text-sm font-bold', f.points > 0 ? 'bg-mint-soft text-emerald-700 dark:bg-mint/15 dark:text-mint' : f.points < 0 ? 'bg-danger-soft text-danger' : 'bg-surface-alt text-ink-muted dark:bg-surface-altdark')}>{f.points > 0 ? '+' : ''}{f.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Бодлогын шалгуур</h4>
                      {a.policyChecks.map((c) => <div key={c.key} className="flex items-center gap-2 py-1 text-sm">{c.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-danger" />}<span>{c.detail}</span></div>)}
                    </div>
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Залилангийн дохио</h4>
                      {a.fraudFlags.length ? a.fraudFlags.map((f) => <div key={f.key} className="flex items-center gap-2 py-1 text-sm"><ShieldAlert className={cn('h-4 w-4', f.severity === 'HIGH' ? 'text-danger' : 'text-amber-600')} /><span>{f.detail}</span><Badge tone={f.severity === 'HIGH' ? 'danger' : 'warning'}>{f.severity}</Badge></div>)
                        : <div className="flex items-center gap-2 text-sm text-ink-muted"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Илрээгүй</div>}
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* Applicant */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title="Зээлдэгч" action={<Link href={`/users/${d.applicant.userId}`} className="text-xs font-semibold text-brand">Профайл</Link>} />
              <CardBody>
                <Row k="Нэр" v={`${s.lastName ?? ''} ${s.firstName ?? ''}`} />
                <Row k="Регистр" v={s.registerNumberLast4 ? `••••••${s.registerNumberLast4}` : '—'} />
                <Row k="Ажлын газар" v={s.employerName ?? '—'} />
                <Row k="Сарын орлого" v={s.monthlyIncome ? formatMNT(s.monthlyIncome) : '—'} />
                <Row k="Бусад зээлийн төлөлт" v={s.monthlyObligations ? formatMNT(s.monthlyObligations) : '—'} />
                <Row k="Иргэний үнэмлэх" v={<StatusBadge status={d.applicant.kycStatus} />} />
                {d.bankAccount && <Row k="Олгох данс" v={`${d.bankAccount.bankName} ${d.bankAccount.accountNumberMasked}`} />}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Зээлийн нөхцөл" subtitle="Илгээх үеийн нөхцөлөөр тогтоогдсон" />
              <CardBody>
                <Row k="Зээлийн дүн" v={formatMNT(d.quote.principal)} />
                <Row k="Хугацаа" v={`${d.termMonths} сар`} />
                <Row k="Сарын хүү" v={formatPercent(d.terms.monthlyInterestRate)} />
                <Row k="Шимтгэл" v={formatMNT(d.quote.serviceFee)} />
                <Row k="Сарын төлөлт" v={formatMNT(d.quote.monthlyPayment)} />
                <Row k="Нийт төлөх" v={formatMNT(d.quote.totalRepayment)} />
                <Row k="APR" v={formatPercent(d.quote.apr)} />
                {d.contract && <button onClick={() => setContractOpen(true)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand"><FileText className="h-3.5 w-3.5" /> Зөвшөөрсөн гэрээ ({formatDateTime(d.contract.acceptedAt ?? '')})</button>}
              </CardBody>
            </Card>
          </div>

          {/* Documents */}
          <Card>
            <CardHeader
              title="Баримт бичиг"
              action={d.applicant.kycStatus !== 'VERIFIED' && (
                <Can perm="kyc.review">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" loading={busy} onClick={() => run(() => api(`users/${d.applicant.userId}/kyc`, { body: { decision: 'REJECTED', note: 'Баримт тодорхойгүй' } }))}>Татгалзах</Button>
                    <Button size="sm" variant="success" loading={busy} onClick={() => run(() => api(`users/${d.applicant.userId}/kyc`, { body: { decision: 'VERIFIED' } }))}><ShieldCheck className="h-3.5 w-3.5" /> Баталгаажуулах</Button>
                  </div>
                </Can>
              )}
            />
            <CardBody className="grid gap-3 sm:grid-cols-3">
              {d.documents.length ? d.documents.map((doc) => (
                <a key={doc.id} href={`/api/proxy/admin/users/${d.applicant.userId}/documents/${doc.id}`} target="_blank" rel="noreferrer" className="rounded-xl2 border border-line p-4 transition hover:border-brand dark:border-line-dark">
                  <FileText className="h-5 w-5 text-brand" />
                  <div className="mt-2 text-sm font-semibold">{DOC_LABEL[doc.type]}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-ink-muted">{formatDate(doc.createdAt)}<StatusBadge status={doc.status} /></div>
                </a>
              )) : <p className="text-sm text-ink-muted">Баримт оруулаагүй</p>}
            </CardBody>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {(d.infoRequest && d.status === 'INFO_REQUESTED') && <Notice tone="info">Хүссэн мэдээлэл: {d.infoRequest}</Notice>}
          {d.status === 'APPROVED' && approver?.admin === me?.name && <Notice>Та энэ зээлийг зөвшөөрсөн тул олголтыг өөр ажилтан бүртгэнэ (four-eyes дүрэм).</Notice>}
          <Card>
            <CardHeader title="Явц" />
            <CardBody>
              <ol className="relative space-y-4 border-l border-line pl-5 dark:border-line-dark">
                {d.history.map((h, i) => (
                  <li key={i}>
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
                    <div className="flex items-center gap-2"><StatusBadge status={h.to} /><span className="text-xs text-ink-muted">{h.actorType}</span></div>
                    <div className="mt-1 text-xs text-ink-muted">{formatDateTime(h.at)}</div>
                    {h.note && <div className="mt-1 text-sm">{h.note}</div>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Дотоод тэмдэглэл" subtitle="Зөвхөн ажилтнуудад харагдана" />
            <CardBody className="space-y-3">
              <Textarea placeholder="Тэмдэглэл бичих…" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button size="sm" disabled={!note.trim()} loading={busy} onClick={() => run(() => api(`applications/${id}/notes`, { body: { body: note } }), () => setNote(''))}>Нэмэх</Button>
              {d.notes.map((n) => (
                <div key={n.id} className="rounded-xl2 bg-surface-alt p-3 text-sm dark:bg-surface-altdark">
                  <div>{n.body}</div>
                  <div className="mt-1 text-xs text-ink-muted">{n.admin} · {formatDateTime(n.at)}</div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog
        open={action !== null}
        onClose={() => setAction(null)}
        title={action === 'APPROVE' ? 'Зээл зөвшөөрөх' : action === 'REJECT' ? 'Хүсэлт татгалзах' : 'Нэмэлт мэдээлэл хүсэх'}
        footer={<><Button variant="ghost" onClick={() => setAction(null)}>Болих</Button><Button variant={action === 'REJECT' ? 'danger' : action === 'APPROVE' ? 'success' : 'primary'} disabled={reason.trim().length < 3} loading={busy} onClick={() => run(() => api(`applications/${id}/decision`, { body: { action, reason } }), () => setAction(null))}>Баталгаажуулах</Button></>}
      >
        <div className="space-y-4">
          {action === 'APPROVE' && a && a.recommendation !== 'APPROVE_RECOMMENDED' && <Notice><AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> AI зөвлөмжөөс өөр шийдвэр гаргаж байна. Үндэслэлээ тодорхой бичнэ үү — аудитад бүртгэгдэнэ.</Notice>}
          <Field label={action === 'APPROVE' ? 'Шийдвэрийн үндэслэл' : 'Хэрэглэгчид харагдах тайлбар'} hint="Хамгийн багадаа 3 тэмдэгт">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={disburseOpen}
        onClose={() => setDisburseOpen(false)}
        title="Олголт бүртгэх"
        footer={<><Button variant="ghost" onClick={() => setDisburseOpen(false)}>Болих</Button><Button disabled={payoutRef.trim().length < 4} loading={busy} onClick={() => run(() => api(`applications/${id}/disburse`, { body: { payoutReference: payoutRef } }), () => setDisburseOpen(false))}>Олголт бүртгэх</Button></>}
      >
        <div className="space-y-4">
          <Notice>Систем мөнгө шилжүүлэхгүй. Банкаар <b>{formatMNT(d.quote.netDisbursement)}</b>-ийг {d.bankAccount?.bankName} {d.bankAccount?.accountNumberMasked} дансанд шилжүүлсний дараа гүйлгээний лавлах дугаарыг оруулна уу.</Notice>
          <Field label="Банкны гүйлгээний лавлах дугаар"><Input value={payoutRef} onChange={(e) => setPayoutRef(e.target.value)} placeholder="ж: KHAN-20261118-0001" autoFocus /></Field>
        </div>
      </Dialog>

      <Dialog open={contractOpen} onClose={() => setContractOpen(false)} title="Зөвшөөрсөн гэрээ" wide>
        {d.contract && (
          <div className="space-y-3">
            <pre className="whitespace-pre-wrap rounded-xl2 bg-surface-alt p-4 font-sans text-xs leading-relaxed dark:bg-surface-altdark">{d.contract.body}</pre>
            <div className="text-xs text-ink-muted">SHA-256: <span className="font-mono">{d.contract.contentHash}</span> · IP {d.contract.acceptedIp ?? '—'} · загвар {d.contract.templateVersion}</div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
