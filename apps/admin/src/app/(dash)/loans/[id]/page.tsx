'use client';
import { formatDate, formatDateTime, formatMNT, formatPercent, type LoanDetailDto } from '@orgil/shared';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Badge, Card, CardBody, CardHeader, ErrorBox, PageHeader, Skeleton, StatusBadge, Table, Tabs, Td, Th } from '@/components/ui/primitives';
import { useApi } from '@/lib/api';

type Detail = LoanDetailDto & {
  borrower: { userId: string; phone: string; name: string };
  application: { id: string; applicationNo: string };
  serviceFee: string; penaltyRateDaily: string;
  ledger: { id: string; reference: string; description: string; account: string; debit: string; credit: string; at: string }[];
};

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: l, error } = useApi<Detail>(`loans/${id}`);
  const [tab, setTab] = useState<'schedule' | 'repayments' | 'ledger'>('schedule');
  if (error) return <ErrorBox error={error} />;
  if (!l) return <Skeleton className="h-96" />;

  const stats = [
    ['Үндсэн зээл', formatMNT(l.principal)], ['Үндсэн үлдэгдэл', formatMNT(l.outstandingPrincipal)], ['Нийт үлдэгдэл (гэрээгээр)', formatMNT(l.totalOutstanding)],
    ['Бүтэн хаах дүн', formatMNT(l.payoffAmount)], ['Төлсөн хүү', formatMNT(l.interestPaid)], ['Сарын хүү', formatPercent(l.monthlyInterestRate)],
    ['Шимтгэл', formatMNT(l.serviceFee)], ['Алданги (өдөр)', formatPercent(l.penaltyRateDaily, 4)],
  ];

  return (
    <div className="animate-rise">
      <Link href="/loans" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Зээлүүд</Link>
      <PageHeader
        title={l.loanNo}
        subtitle={`${l.borrower.name || l.borrower.phone} · ${l.product.nameMn} · олгосон ${formatDate(l.disbursedAt)} · дуусах ${formatDate(l.maturityDate)}`}
        actions={<><StatusBadge status={l.status} /><Link href={`/applications/${l.application.id}`} className="text-sm font-semibold text-brand">{l.application.applicationNo}</Link><Link href={`/users/${l.borrower.userId}`} className="text-sm font-semibold text-brand">Зээлдэгч</Link></>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([k, v]) => <Card key={k} className="p-4"><div className="text-xs text-ink-muted">{k}</div><div className="tabular mt-1 font-display text-lg font-extrabold">{v}</div></Card>)}
      </div>
      <div className="my-5"><Tabs value={tab} onChange={setTab} items={[{ value: 'schedule', label: 'Хуваарь', count: l.schedule.length }, { value: 'repayments', label: 'Төлөлтүүд', count: l.repayments.length }, { value: 'ledger', label: 'Ерөнхий журнал', count: l.ledger.length }]} /></div>
      <Card>
        <CardHeader title={tab === 'schedule' ? 'Эргэн төлөлтийн хуваарь' : tab === 'repayments' ? 'Төлөлтийн түүх' : 'Давхар бичилтийн журнал'} subtitle={tab === 'ledger' ? 'Дебит = Кредит; бичилт өөрчлөгдөхгүй' : undefined} />
        <CardBody className="px-0">
          {tab === 'schedule' && (
            <Table>
              <thead><tr><Th>№</Th><Th>Огноо</Th><Th className="text-right">Үндсэн</Th><Th className="text-right">Хүү</Th><Th className="text-right">Шимтгэл</Th><Th className="text-right">Алданги</Th><Th className="text-right">Төлсөн</Th><Th className="text-right">Үлдэгдэл</Th><Th>Төлөв</Th></tr></thead>
              <tbody>{l.schedule.map((s) => (
                <tr key={s.id}><Td>{s.installmentNo}</Td><Td>{formatDate(s.dueDate)}</Td><Td className="tabular text-right">{formatMNT(s.principalDue)}</Td><Td className="tabular text-right">{formatMNT(s.interestDue)}</Td><Td className="tabular text-right">{formatMNT(s.feeDue)}</Td><Td className="tabular text-right">{formatMNT(s.penaltyDue)}</Td><Td className="tabular text-right">{formatMNT(s.totalPaid)}</Td><Td className="tabular text-right font-semibold">{formatMNT(s.remaining)}</Td><Td><StatusBadge status={s.status} /></Td></tr>
              ))}</tbody>
            </Table>
          )}
          {tab === 'repayments' && (
            <Table>
              <thead><tr><Th>Баримт</Th><Th>Огноо</Th><Th>Суваг</Th><Th className="text-right">Дүн</Th><Th className="text-right">Үндсэн</Th><Th className="text-right">Хүү</Th><Th className="text-right">Шимтгэл</Th><Th className="text-right">Алданги</Th></tr></thead>
              <tbody>{l.repayments.map((r) => (
                <tr key={r.id}><Td className="font-mono text-xs">{r.receiptNo}</Td><Td>{formatDateTime(r.paidAt)}</Td><Td>{r.provider}{r.sandbox && <Badge className="ml-1" tone="warning">SANDBOX</Badge>}</Td><Td className="tabular text-right font-semibold">{formatMNT(r.amount)}</Td><Td className="tabular text-right">{formatMNT(r.principalPart)}</Td><Td className="tabular text-right">{formatMNT(r.interestPart)}</Td><Td className="tabular text-right">{formatMNT(r.feePart)}</Td><Td className="tabular text-right">{formatMNT(r.penaltyPart)}</Td></tr>
              ))}{!l.repayments.length && <tr><Td colSpan={8} className="py-8 text-center text-ink-muted">Төлөлт алга</Td></tr>}</tbody>
            </Table>
          )}
          {tab === 'ledger' && (
            <Table>
              <thead><tr><Th>Огноо</Th><Th>Лавлах</Th><Th>Данс</Th><Th className="text-right">Дебит</Th><Th className="text-right">Кредит</Th></tr></thead>
              <tbody>{l.ledger.map((x) => (
                <tr key={x.id}><Td className="text-ink-muted">{formatDateTime(x.at)}</Td><Td className="font-mono text-xs">{x.reference}</Td><Td>{x.account}</Td><Td className="tabular text-right">{x.debit !== '0.00' ? formatMNT(x.debit) : ''}</Td><Td className="tabular text-right">{x.credit !== '0.00' ? formatMNT(x.credit) : ''}</Td></tr>
              ))}</tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
