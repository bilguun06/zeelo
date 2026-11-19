'use client';
import { formatDateTime, formatMNT } from '@orgil/shared';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, EmptyState, ErrorBox, Input, PageHeader, Pagination, StatusBadge, Table, TableSkeleton, Tabs, Td, Th } from '@/components/ui/primitives';
import { qs, useApi, type Page } from '@/lib/api';
import { STATUS_LABEL } from '@/lib/utils';

interface Row { id: string; applicationNo: string; status: string; amount: string; termMonths: number; product: string; applicant: string; phone: string; score: number | null; riskGrade: string | null; recommendation: string | null; submittedAt: string | null }

const FILTERS = [
  { value: 'UNDER_REVIEW,PENDING', label: 'Хянах' },
  { value: 'INFO_REQUESTED', label: 'Мэдээлэл хүссэн' },
  { value: 'APPROVED', label: 'Олголт хүлээж буй' },
  { value: 'DISBURSED,COMPLETED', label: 'Олгосон' },
  { value: 'REJECTED,CANCELLED', label: 'Татгалзсан' },
  { value: '', label: 'Бүгд' },
];
const REC_TONE: Record<string, 'success' | 'warning' | 'danger'> = { APPROVE_RECOMMENDED: 'success', MANUAL_REVIEW: 'warning', DECLINE_RECOMMENDED: 'danger' };

export default function ApplicationsPage() {
  const [status, setStatus] = useState('UNDER_REVIEW,PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, isLoading } = useApi<Page<Row>>(`applications${qs({ status, search, page, pageSize: 20 })}`, { keepPreviousData: true });

  return (
    <div className="animate-rise">
      <PageHeader title="Зээлийн хүсэлт" subtitle="AI үнэлгээ зөвхөн зөвлөмж — эцсийн шийдвэрийг зээлийн ажилтан гаргана" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={FILTERS} />
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input className="pl-9" placeholder="Дугаар, утас…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>
      <ErrorBox error={error} />
      <Card>
        {isLoading && !data ? <TableSkeleton /> : !data?.items.length ? <EmptyState title="Хүсэлт олдсонгүй" /> : (
          <>
            <Table>
              <thead><tr><Th>Дугаар</Th><Th>Зээлдэгч</Th><Th>Бүтээгдэхүүн</Th><Th className="text-right">Дүн</Th><Th>Хугацаа</Th><Th>Оноо</Th><Th>AI зөвлөмж</Th><Th>Төлөв</Th><Th>Илгээсэн</Th></tr></thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-alt/60 dark:hover:bg-surface-altdark/60">
                    <Td><Link href={`/applications/${a.id}`} className="font-semibold text-brand hover:underline">{a.applicationNo}</Link></Td>
                    <Td><div className="font-medium">{a.applicant}</div><div className="text-xs text-ink-muted">{a.phone}</div></Td>
                    <Td className="text-ink-muted">{a.product}</Td>
                    <Td className="tabular text-right font-semibold">{formatMNT(a.amount)}</Td>
                    <Td>{a.termMonths} сар</Td>
                    <Td>{a.score ? <span className="font-semibold">{a.score} <span className="text-ink-muted">({a.riskGrade})</span></span> : '—'}</Td>
                    <Td>{a.recommendation ? <Badge tone={REC_TONE[a.recommendation]}>{STATUS_LABEL[a.recommendation]}</Badge> : '—'}</Td>
                    <Td><StatusBadge status={a.status} /></Td>
                    <Td className="text-ink-muted">{a.submittedAt ? formatDateTime(a.submittedAt) : '—'}</Td>
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
