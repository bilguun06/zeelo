'use client';
import { formatDateTime } from '@orgil/shared';
import { useState } from 'react';
import { Badge, Card, Dialog, EmptyState, ErrorBox, Input, PageHeader, Pagination, Select, Table, TableSkeleton, Td, Th } from '@/components/ui/primitives';
import { qs, useApi, type Page } from '@/lib/api';

interface Log { id: string; actorType: string; actorId: string | null; actorName: string | null; action: string; entityType: string; entityId: string | null; before: unknown; after: unknown; ip: string | null; requestId: string | null; createdAt: string }

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Log | null>(null);
  const { data, error, isLoading } = useApi<Page<Log>>(`audit-logs${qs({ action, entityType, page, pageSize: 30 })}`, { keepPreviousData: true });

  return (
    <div className="animate-rise">
      <PageHeader title="Аудит лог" subtitle="Бүх чухал үйлдэл өөрчлөгдөшгүй бүртгэгдэнэ. Нууц мэдээлэл автоматаар нуугдана." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="w-64" placeholder="Үйлдэл (ж: application.approve)" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
        <Select className="w-52" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}>
          <option value="">Бүх объект</option>
          {['LoanApplication', 'Loan', 'LoanProduct', 'User', 'UserProfile', 'UserDocument', 'PaymentIntent', 'AdminUser', 'Role', 'SystemSetting', 'Announcement'].map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </div>
      <ErrorBox error={error} />
      <Card>
        {isLoading && !data ? <TableSkeleton /> : !data?.items.length ? <EmptyState title="Бүртгэл алга" /> : (
          <>
            <Table>
              <thead><tr><Th>Огноо</Th><Th>Гүйцэтгэгч</Th><Th>Үйлдэл</Th><Th>Объект</Th><Th>IP</Th></tr></thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id} className="cursor-pointer hover:bg-surface-alt/60 dark:hover:bg-surface-altdark/60" onClick={() => setOpen(l)}>
                    <Td className="text-ink-muted">{formatDateTime(l.createdAt)}</Td>
                    <Td><Badge tone={l.actorType === 'ADMIN' ? 'info' : l.actorType === 'SYSTEM' ? 'neutral' : 'success'}>{l.actorType}</Badge> <span className="ml-1">{l.actorName !== l.actorType ? l.actorName : ''}</span></Td>
                    <Td className="font-mono text-xs font-semibold">{l.action}</Td>
                    <Td className="text-ink-muted">{l.entityType} <span className="font-mono text-xs">{l.entityId?.slice(0, 8)}</span></Td>
                    <Td className="text-ink-muted">{l.ip ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.action ?? ''} wide>
        {open && (
          <div className="space-y-3 text-sm">
            <div className="text-ink-muted">Request ID: <span className="font-mono">{open.requestId ?? '—'}</span></div>
            {(['before', 'after'] as const).map((k) => open[k] ? (
              <div key={k}><div className="mb-1 text-xs font-semibold uppercase text-ink-muted">{k === 'before' ? 'Өмнө' : 'Дараа'}</div><pre className="overflow-x-auto rounded-xl2 bg-surface-alt p-3 text-xs dark:bg-surface-altdark">{JSON.stringify(open[k], null, 2)}</pre></div>
            ) : null)}
          </div>
        )}
      </Dialog>
    </div>
  );
}
