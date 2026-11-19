'use client';
import { formatDate, formatMNT } from '@orgil/shared';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Card, EmptyState, ErrorBox, Input, PageHeader, Pagination, Select, StatusBadge, Table, TableSkeleton, Td, Th } from '@/components/ui/primitives';
import { qs, useApi, type Page } from '@/lib/api';

interface Row { id: string; phone: string; name: string | null; status: string; kycStatus: string; monthlyIncome: string | null; activeLoans: number; applications: number; createdAt: string; lastLoginAt: string | null }

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [kyc, setKyc] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, isLoading } = useApi<Page<Row>>(`users${qs({ search, status, kyc, page, pageSize: 20 })}`, { keepPreviousData: true });

  return (
    <div className="animate-rise">
      <PageHeader title="Хэрэглэгчид" subtitle="Регистрээр хайхад бүтэн дугаараа оруулна (шифрлэгдсэн хайлт)" />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input className="pl-9" placeholder="Утас, нэр, регистр…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select className="w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Бүх төлөв</option><option value="ACTIVE">Идэвхтэй</option><option value="SUSPENDED">Түдгэлзүүлсэн</option><option value="CLOSED">Хаасан</option>
        </Select>
        <Select className="w-52" value={kyc} onChange={(e) => { setKyc(e.target.value); setPage(1); }}>
          <option value="">Баталгаажуулалт: бүгд</option><option value="PENDING">Хянагдаж буй</option><option value="VERIFIED">Баталгаажсан</option><option value="NOT_STARTED">Эхлээгүй</option><option value="REJECTED">Татгалзсан</option>
        </Select>
      </div>
      <ErrorBox error={error} />
      <Card>
        {isLoading && !data ? <TableSkeleton /> : !data?.items.length ? <EmptyState title="Хэрэглэгч олдсонгүй" /> : (
          <>
            <Table>
              <thead><tr><Th>Хэрэглэгч</Th><Th>Утас</Th><Th>Үнэмлэх</Th><Th className="text-right">Орлого</Th><Th>Идэвхтэй зээл</Th><Th>Хүсэлт</Th><Th>Төлөв</Th><Th>Бүртгүүлсэн</Th></tr></thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-alt/60 dark:hover:bg-surface-altdark/60">
                    <Td><Link href={`/users/${u.id}`} className="font-semibold text-brand hover:underline">{u.name ?? 'Нэргүй'}</Link></Td>
                    <Td>{u.phone}</Td>
                    <Td><StatusBadge status={u.kycStatus} /></Td>
                    <Td className="tabular text-right">{u.monthlyIncome ? formatMNT(u.monthlyIncome) : '—'}</Td>
                    <Td>{u.activeLoans}</Td><Td>{u.applications}</Td>
                    <Td><StatusBadge status={u.status} /></Td>
                    <Td className="text-ink-muted">{formatDate(u.createdAt)}</Td>
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
