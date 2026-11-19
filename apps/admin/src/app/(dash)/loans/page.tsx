'use client';
import { formatDate, formatMNT, type LoanDto } from '@orgil/shared';
import { RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Can } from '@/components/admin-context';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorBox, Input, PageHeader, Pagination, StatusBadge, Table, TableSkeleton, Tabs, Td, Th } from '@/components/ui/primitives';
import { api, qs, useApi, type Page } from '@/lib/api';

type Row = LoanDto & { phone: string; borrower: string };
interface Recon { id: string; loanNo: string; phone: string; amount: string; provider: string; status: string; failureReason: string | null; paidAt: string | null; sandbox: boolean }

function LoansInner() {
  const initial = useSearchParams().get('status') ?? '';
  const [status, setStatus] = useState(initial);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const { data, error, isLoading, mutate } = useApi<Page<Row>>(`loans${qs({ status, search, page, pageSize: 20 })}`, { keepPreviousData: true });
  const { data: recon, mutate: mutateRecon } = useApi<Recon[]>('payments/reconciliation');

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); await Promise.all([mutate(), mutateRecon()]); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <div className="animate-rise">
      <PageHeader
        title="Зээлүүд"
        subtitle="Зээлийн багц, эргэн төлөлтийн хуваарь, үлдэгдэл"
        actions={<Can perm="loans.disburse"><Button variant="outline" loading={busy} onClick={() => act(() => api('loans/jobs/refresh-overdue', { method: 'POST' }))}><RefreshCw className="h-4 w-4" /> Хугацаа хэтрэлт шинэчлэх</Button></Can>}
      />
      <ErrorBox error={err ?? error} />
      {recon && recon.length > 0 && (
        <Card className="mb-6 border-warning/40">
          <CardHeader title="Тулгалт шаардлагатай төлбөрүүд" subtitle="Төлөгдсөн боловч зээлд хуваарилагдаагүй (хаагдсан зээл, дүн зөрүүтэй г.м.)" />
          <CardBody className="px-0">
            <Table>
              <thead><tr><Th>Зээл</Th><Th>Утас</Th><Th className="text-right">Дүн</Th><Th>Суваг</Th><Th>Шалтгаан</Th><Th /></tr></thead>
              <tbody>
                {recon.map((r) => (
                  <tr key={r.id}><Td>{r.loanNo}</Td><Td>{r.phone}</Td><Td className="tabular text-right">{formatMNT(r.amount)}</Td><Td>{r.provider}{r.sandbox && <Badge className="ml-1">SANDBOX</Badge>}</Td><Td className="text-ink-muted">{r.failureReason ?? '—'}</Td>
                    <Td><Can perm="loans.disburse"><Button size="sm" variant="outline" loading={busy} onClick={() => confirm('Төлбөрийг буцаах уу?') && act(() => api(`payments/${r.id}/refund`, { method: 'POST' }))}>Буцаалт</Button></Can></Td></tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ value: '', label: 'Бүгд' }, { value: 'ACTIVE', label: 'Идэвхтэй' }, { value: 'OVERDUE', label: 'Хугацаа хэтэрсэн' }, { value: 'COMPLETED', label: 'Хаагдсан' }]} />
        <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" /><Input className="pl-9" placeholder="Зээлийн дугаар, утас…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
      </div>
      <Card>
        {isLoading && !data ? <TableSkeleton /> : !data?.items.length ? <EmptyState title="Зээл олдсонгүй" /> : (
          <>
            <Table>
              <thead><tr><Th>Дугаар</Th><Th>Зээлдэгч</Th><Th>Бүтээгдэхүүн</Th><Th className="text-right">Үндсэн</Th><Th className="text-right">Үндсэн үлдэгдэл</Th><Th className="text-right">Нийт үлдэгдэл</Th><Th>Дараагийн төлөлт</Th><Th>Явц</Th><Th>Төлөв</Th></tr></thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-alt/60 dark:hover:bg-surface-altdark/60">
                    <Td><Link href={`/loans/${l.id}`} className="font-semibold text-brand hover:underline">{l.loanNo}</Link></Td>
                    <Td><div>{l.borrower}</div><div className="text-xs text-ink-muted">{l.phone}</div></Td>
                    <Td className="text-ink-muted">{l.product.nameMn}</Td>
                    <Td className="tabular text-right">{formatMNT(l.principal)}</Td>
                    <Td className="tabular text-right font-semibold">{formatMNT(l.outstandingPrincipal)}</Td>
                    <Td className="tabular text-right">{formatMNT(l.totalOutstanding)}</Td>
                    <Td>{l.nextDue ? <span>{formatDate(l.nextDue.date)}<span className="ml-1 text-ink-muted">{formatMNT(l.nextDue.amount)}</span></span> : '—'}</Td>
                    <Td><div className="h-1.5 w-20 rounded-full bg-surface-alt dark:bg-surface-altdark"><div className="h-1.5 rounded-full bg-mint" style={{ width: `${l.progress * 100}%` }} /></div><div className="mt-1 text-xs text-ink-muted">{l.paidInstallments}/{l.termMonths}</div></Td>
                    <Td><StatusBadge status={l.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

export default function LoansPage() {
  return <Suspense><LoansInner /></Suspense>;
}
