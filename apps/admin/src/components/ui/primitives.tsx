'use client';
import { statusTone } from '@orgil/ui';
import { ChevronLeft, ChevronRight, Inbox, X } from 'lucide-react';
import { forwardRef, useEffect, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TdHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn, STATUS_LABEL } from '@/lib/utils';
import { Button } from './button';

// ── Card ──
export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-line/70 bg-surface shadow-card dark:border-line-dark dark:bg-surface-dark', className)} {...p} />;
}
export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-6 pt-5', className)}>
      <div>
        <h3 className="font-display text-base font-bold text-ink dark:text-ink-inverse">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function CardBody({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pb-6 pt-4', className)} {...p} />;
}

// ── Badge ──
const TONES = {
  info: 'bg-brand-soft text-brand dark:bg-brand/15',
  success: 'bg-mint-soft text-emerald-700 dark:bg-mint/15 dark:text-mint',
  warning: 'bg-warning-soft text-amber-700 dark:bg-warning/15 dark:text-warning',
  danger: 'bg-danger-soft text-danger dark:bg-danger/15',
  neutral: 'bg-surface-alt text-ink-muted dark:bg-surface-altdark',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>{children}</span>;
}
export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone[status] ?? (status === 'VERIFIED' || status === 'SENT' ? 'success' : status === 'SUSPENDED' || status === 'FAILED' ? 'danger' : 'neutral');
  return <Badge tone={tone}>{STATUS_LABEL[status] ?? status}</Badge>;
}

// ── Form ──
const field = 'h-10 w-full rounded-xl2 border border-line bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-line-dark dark:bg-surface-altdark dark:text-ink-inverse';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(field, className)} {...p} />);
Input.displayName = 'Input';
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn(field, 'pr-8', className)} {...p} />);
Select.displayName = 'Select';
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, 'h-auto min-h-[96px] py-2', className)} {...p} />);
Textarea.displayName = 'Textarea';
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      {children}
      {error ? <span className="block text-xs text-danger">{error}</span> : hint ? <span className="block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm">
      <span className={cn('relative h-6 w-11 rounded-full transition', checked ? 'bg-brand' : 'bg-line dark:bg-line-dark')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      {label && <span className="text-ink dark:text-ink-inverse">{label}</span>}
    </button>
  );
}

// ── Table ──
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('whitespace-nowrap border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:border-line-dark', className)}>{children}</th>;
}
export function Td({ children, className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('whitespace-nowrap border-b border-line/60 px-4 py-3 text-ink dark:border-line-dark/60 dark:text-ink-inverse', className)} {...p}>{children}</td>;
}

// ── Feedback ──
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl2 bg-surface-alt dark:bg-surface-altdark', className)} />;
}
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="space-y-2 p-6">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>;
}
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="rounded-2xl bg-surface-alt p-4 dark:bg-surface-altdark"><Inbox className="h-6 w-6 text-ink-muted" /></div>
      <p className="font-semibold text-ink dark:text-ink-inverse">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink-muted">{body}</p>}
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="rounded-xl2 border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error instanceof Error ? error.message : String(error)}</div>;
}
export function Notice({ children, tone = 'warning' }: { children: ReactNode; tone?: 'warning' | 'info' }) {
  return <div className={cn('rounded-xl2 px-4 py-3 text-xs font-medium', tone === 'warning' ? 'bg-warning-soft text-amber-800 dark:bg-warning/10 dark:text-warning' : 'bg-brand-soft text-brand dark:bg-brand/10')}>{children}</div>;
}

// ── Layout helpers ──
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink dark:text-ink-inverse">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between px-6 py-4 text-xs text-ink-muted">
      <span>Нийт {total.toLocaleString()} · {page}/{pages} хуудас</span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Өмнөх"><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Дараах"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl2 bg-surface-alt p-1 dark:bg-surface-altdark">
      {items.map((i) => (
        <button key={i.value} onClick={() => onChange(i.value)} className={cn('rounded-xl px-3.5 py-1.5 text-sm font-semibold transition', value === i.value ? 'bg-surface text-ink shadow-card dark:bg-surface-dark dark:text-ink-inverse' : 'text-ink-muted hover:text-ink dark:hover:text-ink-inverse')}>
          {i.label}{i.count !== undefined && <span className="ml-1.5 text-xs opacity-70">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Dialog ──
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-[fade_.15s_ease-out] bg-navy/50 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal className={cn('relative flex max-h-[90vh] w-full flex-col rounded-xl3 bg-surface shadow-raised animate-[pop_.18s_ease-out] dark:bg-surface-dark', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4 dark:border-line-dark">
          <h2 className="font-display text-lg font-bold text-ink dark:text-ink-inverse">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Хаах"><X className="h-4 w-4" /></Button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4 dark:border-line-dark">{footer}</div>}
      </div>
    </div>
  );
}
