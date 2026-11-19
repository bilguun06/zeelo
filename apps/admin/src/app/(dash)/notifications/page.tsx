'use client';
import { formatDateTime } from '@orgil/shared';
import { Megaphone, Pencil, Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, Dialog, ErrorBox, Field, Input, PageHeader, Select, StatusBadge, Table, Tabs, Td, Textarea, Th } from '@/components/ui/primitives';
import { api, useApi } from '@/lib/api';

interface Template { code: string; isCustom: boolean; category: string; titleMn: string; bodyMn: string; titleEn: string; bodyEn: string; variables: string[] }
interface Announcement { id: string; titleMn: string; bodyMn: string; audience: string; status: string; scheduledAt: string | null; sentAt: string | null; recipients: number; createdAt: string; createdBy: { name: string } }

const AUDIENCE: Record<string, string> = { ALL: 'Бүх хэрэглэгч', ACTIVE_BORROWERS: 'Идэвхтэй зээлдэгчид', OVERDUE_BORROWERS: 'Хугацаа хэтэрсэн зээлдэгчид' };
const blank = { titleMn: '', bodyMn: '', titleEn: '', bodyEn: '', audience: 'ALL', scheduledAt: '' };

export default function NotificationsPage() {
  const [tab, setTab] = useState<'announcements' | 'templates'>('announcements');
  const { data: anns, mutate: mutateAnns } = useApi<Announcement[]>('notifications/announcements');
  const { data: tpls, mutate: mutateTpls } = useApi<Template[]>('notifications/templates');
  const [form, setForm] = useState<typeof blank | null>(null);
  const [tpl, setTpl] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setErr(null);
    try { await fn(); await Promise.all([mutateAnns(), mutateTpls()]); after?.(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <div className="animate-rise">
      <PageHeader title="Мэдэгдэл" subtitle="Зарлал илгээх, товлох; автомат мэдэгдлийн загвар засах" actions={<Button onClick={() => { setErr(null); setForm(blank); }}><Megaphone className="h-4 w-4" /> Шинэ зарлал</Button>} />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: 'announcements', label: 'Зарлалууд' }, { value: 'templates', label: 'Загварууд' }]} /></div>
      <ErrorBox error={err} />
      {tab === 'announcements' ? (
        <Card>
          <CardBody className="px-0">
            <Table>
              <thead><tr><Th>Гарчиг</Th><Th>Хүлээн авагч</Th><Th>Төлөв</Th><Th>Товлосон / илгээсэн</Th><Th>Хүрсэн</Th><Th>Үүсгэсэн</Th><Th /></tr></thead>
              <tbody>
                {anns?.map((a) => (
                  <tr key={a.id}>
                    <Td><div className="font-semibold">{a.titleMn}</div><div className="max-w-xs truncate text-xs text-ink-muted">{a.bodyMn}</div></Td>
                    <Td>{AUDIENCE[a.audience]}</Td><Td><StatusBadge status={a.status} /></Td>
                    <Td className="text-ink-muted">{a.sentAt ? formatDateTime(a.sentAt) : a.scheduledAt ? formatDateTime(a.scheduledAt) : '—'}</Td>
                    <Td>{a.recipients}</Td><Td className="text-ink-muted">{a.createdBy.name}</Td>
                    <Td className="space-x-2 text-right">
                      {['DRAFT', 'SCHEDULED'].includes(a.status) && <>
                        <Button size="sm" variant="ghost" loading={busy} onClick={() => run(() => api(`notifications/announcements/${a.id}/cancel`, { method: 'POST' }))}>Цуцлах</Button>
                        <Button size="sm" loading={busy} onClick={() => confirm('Одоо илгээх үү?') && run(() => api(`notifications/announcements/${a.id}/send`, { method: 'POST' }))}><Send className="h-3.5 w-3.5" /> Илгээх</Button>
                      </>}
                    </Td>
                  </tr>
                ))}
                {anns && !anns.length && <tr><Td colSpan={7} className="py-10 text-center text-ink-muted">Зарлал алга</Td></tr>}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tpls?.map((t) => (
            <Card key={t.code}>
              <CardHeader title={t.titleMn} subtitle={t.code} action={<div className="flex items-center gap-2">{t.isCustom && <Badge tone="info">Засварласан</Badge>}<Button size="sm" variant="outline" onClick={() => { setErr(null); setTpl(t); }}><Pencil className="h-3.5 w-3.5" /></Button></div>} />
              <CardBody>
                <p className="text-sm">{t.bodyMn}</p>
                <div className="mt-3 flex flex-wrap gap-1">{t.variables.map((v) => <code key={v} className="rounded bg-surface-alt px-1.5 py-0.5 text-xs dark:bg-surface-altdark">{v}</code>)}</div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!form} onClose={() => setForm(null)} title="Шинэ зарлал" wide
        footer={<><Button variant="ghost" onClick={() => setForm(null)}>Болих</Button><Button loading={busy} disabled={!form?.titleMn || !form?.bodyMn || !form?.titleEn || !form?.bodyEn} onClick={() => form && run(() => api('notifications/announcements', { body: { ...form, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined } }), () => setForm(null))}>{form?.scheduledAt ? 'Товлох' : 'Ноорог хадгалах'}</Button></>}>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Гарчиг (MN)"><Input value={form.titleMn} onChange={(e) => setForm({ ...form, titleMn: e.target.value })} /></Field>
            <Field label="Гарчиг (EN)"><Input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} /></Field>
            <Field label="Агуулга (MN)"><Textarea value={form.bodyMn} onChange={(e) => setForm({ ...form, bodyMn: e.target.value })} /></Field>
            <Field label="Агуулга (EN)"><Textarea value={form.bodyEn} onChange={(e) => setForm({ ...form, bodyEn: e.target.value })} /></Field>
            <Field label="Хүлээн авагч"><Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>{Object.entries(AUDIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Товлох огноо (заавал биш)" hint="Хоосон бол ноорог болж хадгалагдана"><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>

      <Dialog open={!!tpl} onClose={() => setTpl(null)} title={`Загвар: ${tpl?.code ?? ''}`} wide
        footer={<><Button variant="ghost" onClick={() => setTpl(null)}>Болих</Button><Button loading={busy} onClick={() => tpl && run(() => api(`notifications/templates/${tpl.code}`, { method: 'PUT', body: { category: tpl.category, titleMn: tpl.titleMn, bodyMn: tpl.bodyMn, titleEn: tpl.titleEn, bodyEn: tpl.bodyEn } }), () => setTpl(null))}>Хадгалах</Button></>}>
        {tpl && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Гарчиг (MN)"><Input value={tpl.titleMn} onChange={(e) => setTpl({ ...tpl, titleMn: e.target.value })} /></Field>
            <Field label="Гарчиг (EN)"><Input value={tpl.titleEn} onChange={(e) => setTpl({ ...tpl, titleEn: e.target.value })} /></Field>
            <Field label="Агуулга (MN)" hint={`Хувьсагч: ${tpl.variables.join(' ')}`}><Textarea value={tpl.bodyMn} onChange={(e) => setTpl({ ...tpl, bodyMn: e.target.value })} /></Field>
            <Field label="Агуулга (EN)"><Textarea value={tpl.bodyEn} onChange={(e) => setTpl({ ...tpl, bodyEn: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
