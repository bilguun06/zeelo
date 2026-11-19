'use client';
import { formatMNT } from '@orgil/shared';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { Can } from '@/components/admin-context';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, EmptyState, ErrorBox, Field, Input, PageHeader, Select, Table, TableSkeleton, Tabs, Td, Th } from '@/components/ui/primitives';
import { download, qs, useApi } from '@/lib/api';

interface Report { title: string; columns: { key: string; label: string; money?: boolean }[]; rows: Record<string, string | number>[]; totals: Record<string, string> }
type Kind = 'summary' | 'disbursements' | 'repayments' | 'overdue';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function ReportsPage() {
  const [kind, setKind] = useState<Kind>('summary');
  const [granularity, setGranularity] = useState<'day' | 'month' | 'year'>('day');
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(iso(new Date()));
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const query = qs({ from, to, granularity: kind === 'summary' ? granularity : undefined });
  const { data, error, isLoading } = useApi<Report>(`reports/${kind}${query}`, { keepPreviousData: true });

  const exportAs = async (format: 'xlsx' | 'pdf') => {
    setBusy(format); setErr(null);
    try { await download(`reports/${kind}${query}${query ? '&' : '?'}format=${format}`); } catch (e) { setErr(e); } finally { setBusy(null); }
  };

  const setPreset = (g: 'day' | 'month' | 'year') => {
    setGranularity(g);
    const now = new Date();
    setTo(iso(now));
    setFrom(iso(g === 'day' ? new Date(Date.now() - 30 * 86_400_000) : g === 'month' ? new Date(now.getFullYear(), now.getMonth() - 11, 1) : new Date(now.getFullYear() - 4, 0, 1)));
  };

  return (
    <div className="animate-rise">
      <PageHeader
        title="Санхүүгийн тайлан"
        subtitle="Өдөр, сар, жилийн тайлан; олголт, эргэн төлөлт, хугацаа хэтрэлт"
        actions={
          <Can perm="reports.export">
            <Button variant="outline" loading={busy === 'xlsx'} onClick={() => exportAs('xlsx')}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button variant="outline" loading={busy === 'pdf'} onClick={() => exportAs('pdf')}><FileDown className="h-4 w-4" /> PDF</Button>
          </Can>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Tabs value={kind} onChange={setKind} items={[{ value: 'summary', label: 'Нэгтгэл' }, { value: 'disbursements', label: 'Олголт' }, { value: 'repayments', label: 'Эргэн төлөлт' }, { value: 'overdue', label: 'Хугацаа хэтэрсэн' }]} />
        {kind === 'summary' && (
          <Field label="Давтамж" className="w-40"><Select value={granularity} onChange={(e) => setPreset(e.target.value as 'day' | 'month' | 'year')}><option value="day">Өдрөөр</option><option value="month">Сараар</option><option value="year">Жилээр</option></Select></Field>
        )}
        {kind !== 'overdue' && (
          <>
            <Field label="Эхлэх" className="w-40"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Дуусах" className="w-40"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </>
        )}
      </div>
      <ErrorBox error={err ?? error} />
      <Card>
        <CardHeader title={data?.title ?? '…'} subtitle={`${data?.rows.length ?? 0} мөр`} />
        <CardBody className="px-0">
          {isLoading && !data ? <TableSkeleton /> : !data?.rows.length ? <EmptyState title="Мэдээлэл алга" body="Сонгосон хугацаанд бүртгэл олдсонгүй" /> : (
            <Table>
              <thead><tr>{data.columns.map((c) => <Th key={c.key} className={c.money ? 'text-right' : ''}>{c.label}</Th>)}</tr></thead>
              <tbody>
                {data.rows.map((r, i) => <tr key={i}>{data.columns.map((c) => <Td key={c.key} className={c.money ? 'tabular text-right' : ''}>{c.money ? formatMNT(String(r[c.key])) : String(r[c.key] ?? '')}</Td>)}</tr>)}
                <tr className="bg-surface-alt/70 font-bold dark:bg-surface-altdark/70">{data.columns.map((c, i) => <Td key={c.key} className={c.money ? 'tabular text-right' : ''}>{i === 0 ? 'Нийт' : data.totals[c.key] ? formatMNT(data.totals[c.key]) : ''}</Td>)}</tr>
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
