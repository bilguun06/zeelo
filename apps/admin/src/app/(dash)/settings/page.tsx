'use client';
import { formatDateTime } from '@orgil/shared';
import { KeyRound, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useAdmin } from '@/components/admin-context';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, Dialog, ErrorBox, Field, Input, Notice, PageHeader, Select, StatusBadge, Table, Tabs, Td, Th } from '@/components/ui/primitives';
import { api, useApi } from '@/lib/api';

interface AdminRow { id: string; email: string; name: string; role: string; roleId: string; status: string; mfaEnabled: boolean; lastLoginAt: string | null }
interface Role { id: string; name: string; description: string; isSystem: boolean; admins: number; permissions: string[] }
interface Perm { key: string; description: string }
interface Setting { key: string; value: string | number; description: string; updatedAt: string | null }
type Tab = 'admins' | 'roles' | 'system' | 'security';

function Security() {
  const { me, reload } = useAdmin();
  const [setup, setSetup] = useState<{ otpauthUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(e); } finally { setBusy(false); } };
  return (
    <Card className="max-w-xl">
      <CardHeader title="Хоёр шатлалт баталгаажуулалт (MFA)" subtitle="TOTP — Google Authenticator, Microsoft Authenticator г.м." />
      <CardBody className="space-y-4">
        <ErrorBox error={err} />
        {me?.mfaEnabled ? <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-mint"><ShieldCheck className="h-5 w-5" /> MFA идэвхтэй</div> : !setup ? (
          <Button loading={busy} onClick={() => run(async () => setSetup(await api('auth/mfa/setup', { method: 'POST' })))}><KeyRound className="h-4 w-4" /> MFA тохируулах</Button>
        ) : (
          <>
            <Notice tone="info">Authenticator апп-даа доорх түлхүүрийг гараар нэмнэ үү (эсвэл otpauth холбоосыг QR болгон уншуулна).</Notice>
            <div className="rounded-xl2 bg-surface-alt p-3 font-mono text-sm tracking-wider dark:bg-surface-altdark">{setup.secret.match(/.{1,4}/g)?.join(' ')}</div>
            <a href={setup.otpauthUrl} className="block truncate text-xs text-brand">{setup.otpauthUrl}</a>
            <Field label="6 оронтой код"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></Field>
            <Button loading={busy} disabled={code.length !== 6} onClick={() => run(async () => { await api('auth/mfa/enable', { body: { code } }); setSetup(null); reload(); })}>Идэвхжүүлэх</Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function SettingsInner() {
  const { can, me } = useAdmin();
  const initial = (useSearchParams().get('tab') as Tab) ?? (can('admins.manage') ? 'admins' : 'security');
  const [tab, setTab] = useState<Tab>(initial);
  const admins = useApi<AdminRow[]>(can('admins.manage') ? 'admins' : null);
  const roles = useApi<Role[]>(can('admins.manage') ? 'roles' : null);
  const perms = useApi<Perm[]>(can('admins.manage') ? 'permissions' : null);
  const settings = useApi<Setting[]>(can('settings.write') ? 'settings' : null);
  const [newAdmin, setNewAdmin] = useState<{ email: string; name: string; password: string; roleId: string } | null>(null);
  const [role, setRole] = useState<{ id: string | null; name: string; description: string; permissions: string[] } | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setErr(null);
    try { await fn(); await Promise.all([admins.mutate(), roles.mutate(), settings.mutate()]); after?.(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  const tabs: { value: Tab; label: string }[] = [
    ...(can('admins.manage') ? [{ value: 'admins' as const, label: 'Админууд' }, { value: 'roles' as const, label: 'Эрх, үүрэг' }] : []),
    ...(can('settings.write') ? [{ value: 'system' as const, label: 'Системийн тохиргоо' }] : []),
    { value: 'security', label: 'Миний аюулгүй байдал' },
  ];

  return (
    <div className="animate-rise">
      <PageHeader title="Тохиргоо" subtitle="Хандах эрх, системийн параметр, аюулгүй байдал" />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={tabs} /></div>
      <ErrorBox error={err} />

      {tab === 'admins' && (
        <Card>
          <CardHeader title="Админ хэрэглэгчид" action={<Button size="sm" onClick={() => setNewAdmin({ email: '', name: '', password: '', roleId: roles.data?.[0]?.id ?? '' })}><UserPlus className="h-4 w-4" /> Нэмэх</Button>} />
          <CardBody className="px-0">
            <Table>
              <thead><tr><Th>Нэр</Th><Th>И-мэйл</Th><Th>Үүрэг</Th><Th>MFA</Th><Th>Сүүлд нэвтэрсэн</Th><Th>Төлөв</Th></tr></thead>
              <tbody>
                {admins.data?.map((a) => (
                  <tr key={a.id}>
                    <Td className="font-semibold">{a.name}</Td><Td>{a.email}</Td>
                    <Td><Select className="h-8 w-44" value={a.roleId} disabled={a.id === me?.id} onChange={(e) => run(() => api(`admins/${a.id}`, { method: 'PATCH', body: { roleId: e.target.value } }))}>{roles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Td>
                    <Td>{a.mfaEnabled ? <Badge tone="success">Идэвхтэй</Badge> : <Badge tone="warning">Үгүй</Badge>}</Td>
                    <Td className="text-ink-muted">{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : '—'}</Td>
                    <Td>
                      <button disabled={a.id === me?.id} onClick={() => run(() => api(`admins/${a.id}`, { method: 'PATCH', body: { status: a.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' } }))} title="Төлөв солих"><StatusBadge status={a.status} /></button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}

      {tab === 'roles' && (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.data?.map((r) => (
            <Card key={r.id}>
              <CardHeader title={r.name} subtitle={`${r.description} · ${r.admins} ажилтан`} action={r.name !== 'SUPER_ADMIN' && <Button size="sm" variant="outline" onClick={() => setRole({ id: r.id, name: r.name, description: r.description, permissions: r.permissions })}>Засах</Button>} />
              <CardBody className="flex flex-wrap gap-1.5">{r.permissions.map((p) => <code key={p} className="rounded-lg bg-surface-alt px-2 py-0.5 text-xs dark:bg-surface-altdark">{p}</code>)}</CardBody>
            </Card>
          ))}
          <button onClick={() => setRole({ id: null, name: '', description: '', permissions: [] })} className="flex min-h-[140px] items-center justify-center gap-2 rounded-card border-2 border-dashed border-line text-sm font-semibold text-ink-muted hover:border-brand hover:text-brand dark:border-line-dark"><Plus className="h-4 w-4" /> Шинэ үүрэг</button>
        </div>
      )}

      {tab === 'system' && (
        <Card>
          <CardHeader title="Системийн параметрүүд" subtitle="Анхдагч утгууд нь хөгжүүлэлтийн жишээ — зээлийн бодлого, хууль тогтоомжтой тулган баталгаажуулна уу" />
          <CardBody className="space-y-3">
            {settings.data?.map((s) => (
              <div key={s.key} className="flex flex-wrap items-center gap-3 border-b border-line/60 pb-3 last:border-0 dark:border-line-dark/60">
                <div className="min-w-[260px] flex-1"><div className="font-mono text-sm font-semibold">{s.key}</div><div className="text-xs text-ink-muted">{s.description}</div></div>
                <Input className="w-48" value={edits[s.key] ?? String(s.value)} onChange={(e) => setEdits({ ...edits, [s.key]: e.target.value })} />
                <Button size="sm" variant="outline" disabled={edits[s.key] === undefined || edits[s.key] === String(s.value)} loading={busy}
                  onClick={() => run(() => api(`settings/${s.key}`, { method: 'PUT', body: { value: typeof s.value === 'number' ? Number(edits[s.key]) : edits[s.key] } }), () => setEdits(({ [s.key]: _, ...rest }) => rest))}>Хадгалах</Button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {tab === 'security' && <Security />}

      <Dialog open={!!newAdmin} onClose={() => setNewAdmin(null)} title="Шинэ админ"
        footer={<><Button variant="ghost" onClick={() => setNewAdmin(null)}>Болих</Button><Button loading={busy} onClick={() => newAdmin && run(() => api('admins', { body: newAdmin }), () => setNewAdmin(null))}>Үүсгэх</Button></>}>
        {newAdmin && (
          <div className="space-y-4">
            <Field label="Нэр"><Input value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} /></Field>
            <Field label="И-мэйл"><Input type="email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} /></Field>
            <Field label="Түр нууц үг" hint="12+ тэмдэгт: том, жижиг үсэг, тоо, тусгай тэмдэгт"><Input type="password" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} /></Field>
            <Field label="Үүрэг"><Select value={newAdmin.roleId} onChange={(e) => setNewAdmin({ ...newAdmin, roleId: e.target.value })}>{roles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
          </div>
        )}
      </Dialog>

      <Dialog open={!!role} onClose={() => setRole(null)} title={role?.id ? 'Үүрэг засах' : 'Шинэ үүрэг'} wide
        footer={<><Button variant="ghost" onClick={() => setRole(null)}>Болих</Button><Button loading={busy} onClick={() => role && run(() => api(role.id ? `roles/${role.id}` : 'roles', { method: role.id ? 'PUT' : 'POST', body: { name: role.name, description: role.description, permissions: role.permissions } }), () => setRole(null))}>Хадгалах</Button></>}>
        {role && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Нэр (A-Z, _)"><Input value={role.name} onChange={(e) => setRole({ ...role, name: e.target.value.toUpperCase() })} /></Field>
              <Field label="Тайлбар"><Input value={role.description} onChange={(e) => setRole({ ...role, description: e.target.value })} /></Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {perms.data?.map((p) => (
                <label key={p.key} className="flex items-start gap-2 rounded-xl2 border border-line p-3 text-sm dark:border-line-dark">
                  <input type="checkbox" className="mt-0.5 accent-[#FF5533]" checked={role.permissions.includes(p.key)} onChange={(e) => setRole({ ...role, permissions: e.target.checked ? [...role.permissions, p.key] : role.permissions.filter((x) => x !== p.key) })} />
                  <span><span className="font-mono text-xs font-semibold">{p.key}</span><span className="block text-xs text-ink-muted">{p.description}</span></span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

export default function SettingsPage() {
  return <Suspense><SettingsInner /></Suspense>;
}
