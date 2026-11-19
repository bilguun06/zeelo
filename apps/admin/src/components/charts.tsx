'use client';
import { formatMNT, formatMNTCompact } from '@orgil/shared';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const axis = { stroke: 'var(--axis)', fontSize: 11, tickLine: false, axisLine: false } as const;

function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl2 border border-line bg-surface px-3 py-2 text-xs shadow-raised dark:border-line-dark dark:bg-surface-dark">
      <div className="mb-1 font-semibold text-ink dark:text-ink-inverse">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-ink-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="tabular font-semibold text-ink dark:text-ink-inverse">{formatMNT(String(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

/** Monthly disbursed vs repaid — two series, one axis, grouped bars with a 2px gap. */
export function MonthlyFlowChart({ data }: { data: { month: string; disbursed: string; repaid: string }[] }) {
  const rows = data.map((d) => ({ month: d.month.slice(2).replace('-', '/'), Олголт: Number(d.disbursed), 'Эргэн төлөлт': Number(d.repaid) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} width={64} tickFormatter={(v: number) => formatMNTCompact(v)} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'var(--grid)', opacity: 0.4 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="Олголт" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="Эргэн төлөлт" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Single-series horizontal magnitude list (no legend — the card title names it). */
export function BarList({ items, format = (v) => v.toLocaleString() }: { items: { label: string; value: number; sub?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.label} className="group" title={`${i.label}: ${format(i.value)}`}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-ink dark:text-ink-inverse">{i.label}</span>
            <span className="tabular text-ink-muted">{format(i.value)}{i.sub && <span className="ml-1">· {i.sub}</span>}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-alt dark:bg-surface-altdark">
            <div className="h-2 rounded-full transition-all group-hover:opacity-80" style={{ width: `${(i.value / max) * 100}%`, background: 'var(--series-1)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
