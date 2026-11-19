'use client';
import { formatMNT, formatMNTCompact } from '@orgil/shared';
import { AlertTriangle, ArrowUpRight, Banknote, CheckCircle2, Clock, FileText, TrendingUp, Users, Wallet, XCircle } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAdmin } from '@/components/admin-context';
import { BarList, MonthlyFlowChart } from '@/components/charts';
import { AuroraBg, GradientIcon, IsoScene, TILE_GRADIENTS, TiltCard, type TileTone } from '@/components/three-d';
import { Card, CardBody, CardHeader, ErrorBox, PageHeader, Skeleton, StatusBadge, Table, Td, Th } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { useApi, type Page } from '@/lib/api';
import { STATUS_LABEL } from '@/lib/utils';

interface Overview {
  totalUsers: number; activeLoans: number; overdueLoans: number; totalOutstanding: string; totalDisbursed: string; totalRepayments: string; overdueAmount: string;
  applications: { pending: number; approved: number; rejected: number; byStatus: { status: string; count: number }[] };
  riskGrades: { grade: string; count: number }[];
  monthly: { month: string; disbursed: string; repaid: string; newUsers: number }[];
  portfolioByProduct: { product: string; outstanding: string; loans: number }[];
}
interface AppRow { id: string; applicationNo: string; applicant: string; amount: string; product: string; status: string; riskGrade: string | null; score: number | null }

function Stat({ label, value, icon, tone = 'blue', sub, href }: { label: string; value: ReactNode; icon: ReactNode; tone?: TileTone; sub?: string; href?: string }) {
  const body = (
    <TiltCard className="h-full rounded-card">
      <Card className="group relative h-full overflow-hidden p-5 hover:shadow-raised">
        <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-[0.12] blur-xl ${TILE_GRADIENTS[tone].split(' shadow')[0]}`} />
        <div className="flex items-start justify-between">
          <GradientIcon tone={tone}>{icon}</GradientIcon>
          {href && <ArrowUpRight className="h-4 w-4 text-ink-muted opacity-0 transition group-hover:opacity-100" />}
        </div>
        <div className="mt-4 text-xs font-medium text-ink-muted">{label}</div>
        <div className="tabular mt-1 font-display text-2xl font-extrabold tracking-tight text-ink dark:text-ink-inverse">{value}</div>
        {sub && <div className="mt-1 text-xs text-ink-muted">{sub}</div>}
      </Card>
    </TiltCard>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Hero({ data, name }: { data: Overview; name: string }) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0B0C12] via-[#3A1D17] to-[#E0451F] p-8 text-white shadow-[0_30px_60px_-20px_rgba(217,58,28,0.6)]">
      <AuroraBg />
      <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-mint backdrop-blur"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" /> Шууд мэдээлэл</div>
          <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight lg:text-4xl">Сайн байна уу, {name.split(' ').pop()}</h1>
          <p className="mt-2 max-w-lg text-sm text-white/65">Зээлийн багцын нийт үлдэгдэл болон өнөөдрийн хянах ажлууд.</p>
          <div className="mt-6 flex flex-wrap gap-8">
            <div><div className="text-xs text-white/55">Нийт зээлийн үлдэгдэл</div><div className="tabular mt-1 font-display text-3xl font-extrabold">{formatMNTCompact(data.totalOutstanding)}</div></div>
            <div><div className="text-xs text-white/55">Хянах хүсэлт</div><div className="tabular mt-1 font-display text-3xl font-extrabold text-mint">{data.applications.pending}</div></div>
            <div><div className="text-xs text-white/55">Хугацаа хэтэрсэн</div><div className="tabular mt-1 font-display text-3xl font-extrabold text-[#FFD3C7]">{data.overdueLoans}</div></div>
          </div>
          <div className="mt-6 flex gap-2">
            <Link href="/applications"><Button className="bg-white text-navy shadow-none hover:bg-white/90">Хүсэлт хянах</Button></Link>
            <Link href="/reports"><Button variant="outline" className="border-white/25 text-white hover:bg-white/10"><FileText className="h-4 w-4" /> Тайлан</Button></Link>
          </div>
        </div>
        <TiltCard max={12} className="hidden lg:block"><IsoScene className="w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]" /></TiltCard>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { can, me } = useAdmin();
  const allowed = can('reports.read');
  const { data, error, isLoading } = useApi<Overview>(allowed ? 'overview' : null, { refreshInterval: 60_000 });
  const { data: queue } = useApi<Page<AppRow>>(can('applications.read') ? 'applications?status=UNDER_REVIEW,PENDING&pageSize=6' : null);

  if (!me || !allowed) return <Skeleton className="h-36" />; // layout redirects roles without dashboard access
  if (error) return <ErrorBox error={error} />;
  return (
    <div className="animate-rise">
      {isLoading || !data ? (
        <div className="space-y-4"><Skeleton className="h-72 rounded-[28px]" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div></div>
      ) : (
        <>
          <Hero data={data} name={me.name} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Нийт хэрэглэгч" value={data.totalUsers.toLocaleString()} icon={<Users className="h-5 w-5" />} href="/users" tone="blue" />
            <Stat label="Идэвхтэй зээл" value={data.activeLoans.toLocaleString()} icon={<Wallet className="h-5 w-5" />} href="/loans" tone="violet" />
            <Stat label="Нийт зээлийн үлдэгдэл" value={formatMNTCompact(data.totalOutstanding)} sub={formatMNT(data.totalOutstanding)} icon={<TrendingUp className="h-5 w-5" />} tone="mint" />
            <Stat label="Нийт олголт" value={formatMNTCompact(data.totalDisbursed)} sub={formatMNT(data.totalDisbursed)} icon={<Banknote className="h-5 w-5" />} tone="ocean" />
            <Stat label="Нийт эргэн төлөлт" value={formatMNTCompact(data.totalRepayments)} sub="Туршилтын төлбөрийг оруулаагүй" icon={<CheckCircle2 className="h-5 w-5" />} tone="mint" />
            <Stat label="Хүлээгдэж буй хүсэлт" value={data.applications.pending} icon={<Clock className="h-5 w-5" />} tone="amber" href="/applications" />
            <Stat label="Зөвшөөрсөн / татгалзсан" value={<span>{data.applications.approved} <span className="text-ink-muted">/</span> {data.applications.rejected}</span>} icon={<XCircle className="h-5 w-5" />} tone="violet" />
            <Stat label="Хугацаа хэтэрсэн зээл" value={data.overdueLoans} sub={formatMNT(data.overdueAmount)} icon={<AlertTriangle className="h-5 w-5" />} tone="rose" href="/loans?status=OVERDUE" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Сарын санхүүгийн гүйцэтгэл" subtitle="Сүүлийн 12 сарын олголт ба эргэн төлөлт (₮)" />
              <CardBody><MonthlyFlowChart data={data.monthly} /></CardBody>
            </Card>
            <Card>
              <CardHeader title="Хүсэлтийн төлөв" subtitle="Бүх хүсэлт" />
              <CardBody>
                <BarList items={data.applications.byStatus.sort((a, b) => b.count - a.count).map((s) => ({ label: STATUS_LABEL[s.status] ?? s.status, value: s.count }))} />
              </CardBody>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Хянагдахыг хүлээж буй хүсэлтүүд" action={<Link href="/applications" className="text-xs font-semibold text-brand">Бүгд</Link>} />
              <CardBody className="px-0 pb-2">
                <Table>
                  <thead><tr><Th>Дугаар</Th><Th>Зээлдэгч</Th><Th>Бүтээгдэхүүн</Th><Th className="text-right">Дүн</Th><Th>Эрсдэл</Th><Th>Төлөв</Th></tr></thead>
                  <tbody>
                    {queue?.items.map((a) => (
                      <tr key={a.id} className="hover:bg-surface-alt/60 dark:hover:bg-surface-altdark/60">
                        <Td><Link href={`/applications/${a.id}`} className="font-semibold text-brand">{a.applicationNo}</Link></Td>
                        <Td>{a.applicant}</Td><Td className="text-ink-muted">{a.product}</Td>
                        <Td className="tabular text-right font-semibold">{formatMNT(a.amount)}</Td>
                        <Td>{a.riskGrade ? <span className="font-semibold">{a.riskGrade} · {a.score}</span> : '—'}</Td>
                        <Td><StatusBadge status={a.status} /></Td>
                      </tr>
                    ))}
                    {queue && !queue.items.length && <tr><Td colSpan={6} className="py-10 text-center text-ink-muted">Хүлээгдэж буй хүсэлт алга</Td></tr>}
                  </tbody>
                </Table>
              </CardBody>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Бүтээгдэхүүнээр үлдэгдэл" />
                <CardBody><BarList items={data.portfolioByProduct.map((p) => ({ label: p.product, value: Number(p.outstanding), sub: `${p.loans} зээл` }))} format={(v) => formatMNTCompact(v)} /></CardBody>
              </Card>
              <Card>
                <CardHeader title="Эрсдэлийн зэрэглэл" subtitle="AI үнэлгээ (зөвлөмж) — симуляцийн өгөгдөл" />
                <CardBody><BarList items={data.riskGrades.map((g) => ({ label: `Зэрэглэл ${g.grade}`, value: g.count }))} /></CardBody>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
