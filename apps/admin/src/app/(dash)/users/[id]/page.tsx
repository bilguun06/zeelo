'use client';
import { formatDate, formatDateTime, formatMNT, type LoanDto } from '@orgil/shared';
import { ArrowLeft, Ban, FileText, ShieldCheck, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Can } from '@/components/admin-context';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, Dialog, ErrorBox, Field, PageHeader, Skeleton, StatusBadge, Table, Td, Textarea, Th } from '@/components/ui/primitives';
import { api, useApi } from '@/lib/api';

interface UserDetail {
  id: string; phone: string; status: string; createdAt: string; lastLoginAt: string | null;
  profile: { firstName: string | null; lastName: string | null; email: string | null; address: string | null; dateOfBirth: string | null; registerNumber: string | null; employerName: string | null; employmentType: string | null; jobTitle: string | null; monthlyIncome: string | null; monthlyObligations: string | null; employmentStartDate: string | null; kycStatus: string } | null;
  documents: { id: string; type: string; status: string; createdAt: string }[];
  bankAccounts: { id: string; bankName: string; accountNumberMasked: string; accountHolder: string; isPrimary: boolean }[];
  loans: LoanDto[];
  applications: { id: string; applicationNo: string; status: string; amount: string; termMonths: number; product: string; createdAt: string }[];
  sessions: { id: string; deviceName: string | null; ip: string | null; lastUsedAt: string }[];
}

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-3 border-b border-line/60 py-2 text-sm last:border-0 dark:border-line-dark/60"><span className="text-ink-muted">{k}</span><span className="text-right font-medium">{v ?? '—'}</span></div>;

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: u, error, mutate } = useApi<UserDetail>(`users/${id}`);
  const [statusDialog, setStatusDialog] = useState<'ACTIVE' | 'SUSPENDED' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); await mutate(); setStatusDialog(null); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  if (error) return <ErrorBox error={error} />;
  if (!u) return <Skeleton className="h-96" />;
  const p = u.profile;

  return (
    <div className="animate-rise">
      <Link href="/users" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Хэрэглэгчид</Link>
      <PageHeader
        title={[p?.lastName, p?.firstName].filter(Boolean).join(' ') || u.phone}
        subtitle={`${u.phone} · бүртгүүлсэн ${formatDate(u.createdAt)} · сүүлд нэвтэрсэн ${u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}`}
        actions={
          <>
            <StatusBadge status={u.status} />
            <Can perm="users.write">
              {u.status === 'ACTIVE'
                ? <Button variant="danger" onClick={() => { setReason(''); setStatusDialog('SUSPENDED'); }}><Ban className="h-4 w-4" /> Түдгэлзүүлэх</Button>
                : <Button variant="success" onClick={() => { setReason(''); setStatusDialog('ACTIVE'); }}><UserCheck className="h-4 w-4" /> Идэвхжүүлэх</Button>}
            </Can>
          </>
        }
      />
      <ErrorBox error={err} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Хувийн мэдээлэл" />
          <CardBody>
            <KV k="Регистр" v={p?.registerNumber} />
            <KV k="Төрсөн огноо" v={p?.dateOfBirth && formatDate(p.dateOfBirth)} />
            <KV k="И-мэйл" v={p?.email} />
            <KV k="Хаяг" v={p?.address} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Ажил, орлого" />
          <CardBody>
            <KV k="Ажлын газар" v={p?.employerName} />
            <KV k="Албан тушаал" v={p?.jobTitle} />
            <KV k="Ажилд орсон" v={p?.employmentStartDate && formatDate(p.employmentStartDate)} />
            <KV k="Сарын орлого" v={p?.monthlyIncome && formatMNT(p.monthlyIncome)} />
            <KV k="Бусад зээлийн төлөлт" v={p?.monthlyObligations && formatMNT(p.monthlyObligations)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Иргэний үнэмлэх"
            action={p?.kycStatus !== 'VERIFIED' && u.documents.length > 0 && <Can perm="kyc.review"><Button size="sm" variant="success" loading={busy} onClick={() => run(() => api(`users/${id}/kyc`, { body: { decision: 'VERIFIED' } }))}><ShieldCheck className="h-3.5 w-3.5" /> Баталгаажуулах</Button></Can>}
          />
          <CardBody className="space-y-2">
            <KV k="Төлөв" v={<StatusBadge status={p?.kycStatus ?? 'NOT_STARTED'} />} />
            {u.documents.map((d) => (
              <a key={d.id} href={`/api/proxy/admin/users/${id}/documents/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl2 border border-line px-3 py-2 text-sm hover:border-brand dark:border-line-dark">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand" />{d.type}</span><StatusBadge status={d.status} />
              </a>
            ))}
            {u.bankAccounts.map((b) => <KV key={b.id} k={`${b.bankName}${b.isPrimary ? ' (үндсэн)' : ''}`} v={b.accountNumberMasked} />)}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Зээлүүд" />
        <CardBody className="px-0">
          <Table>
            <thead><tr><Th>Дугаар</Th><Th>Бүтээгдэхүүн</Th><Th className="text-right">Үндсэн</Th><Th className="text-right">Үлдэгдэл</Th><Th>Дараагийн төлөлт</Th><Th>Төлөв</Th></tr></thead>
            <tbody>
              {u.loans.map((l) => (
                <tr key={l.id}><Td><Link className="font-semibold text-brand" href={`/loans/${l.id}`}>{l.loanNo}</Link></Td><Td>{l.product.nameMn}</Td><Td className="tabular text-right">{formatMNT(l.principal)}</Td><Td className="tabular text-right">{formatMNT(l.outstandingPrincipal)}</Td><Td>{l.nextDue ? `${formatDate(l.nextDue.date)} · ${formatMNT(l.nextDue.amount)}` : '—'}</Td><Td><StatusBadge status={l.status} /></Td></tr>
              ))}
              {!u.loans.length && <tr><Td colSpan={6} className="py-8 text-center text-ink-muted">Зээл алга</Td></tr>}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Хүсэлтүүд" />
          <CardBody className="px-0">
            <Table>
              <thead><tr><Th>Дугаар</Th><Th className="text-right">Дүн</Th><Th>Төлөв</Th><Th>Огноо</Th></tr></thead>
              <tbody>{u.applications.map((a) => <tr key={a.id}><Td><Link className="font-semibold text-brand" href={`/applications/${a.id}`}>{a.applicationNo}</Link></Td><Td className="tabular text-right">{formatMNT(a.amount)}</Td><Td><StatusBadge status={a.status} /></Td><Td className="text-ink-muted">{formatDate(a.createdAt)}</Td></tr>)}</tbody>
            </Table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Идэвхтэй төхөөрөмжүүд" />
          <CardBody>{u.sessions.map((s) => <KV key={s.id} k={s.deviceName ?? 'Тодорхойгүй'} v={`${s.ip ?? ''} · ${formatDateTime(s.lastUsedAt)}`} />)}{!u.sessions.length && <p className="text-sm text-ink-muted">Алга</p>}</CardBody>
        </Card>
      </div>

      <Dialog
        open={statusDialog !== null}
        onClose={() => setStatusDialog(null)}
        title={statusDialog === 'SUSPENDED' ? 'Хэрэглэгч түдгэлзүүлэх' : 'Хэрэглэгч идэвхжүүлэх'}
        footer={<><Button variant="ghost" onClick={() => setStatusDialog(null)}>Болих</Button><Button variant={statusDialog === 'SUSPENDED' ? 'danger' : 'success'} disabled={reason.trim().length < 3} loading={busy} onClick={() => run(() => api(`users/${id}/status`, { method: 'PATCH', body: { status: statusDialog, reason } }))}>Баталгаажуулах</Button></>}
      >
        <Field label="Шалтгаан" hint={statusDialog === 'SUSPENDED' ? 'Түдгэлзүүлэхэд бүх идэвхтэй нэвтрэлт цуцлагдана' : undefined}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
      </Dialog>
    </div>
  );
}
