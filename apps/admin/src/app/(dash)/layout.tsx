'use client';
import {
  BarChart3, Bell, Boxes, FileCheck2, LayoutDashboard, LogOut, Menu, Moon, ScrollText, Settings, Sun, Users, Wallet, X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AdminProvider, useAdmin } from '@/components/admin-context';
import { Logo } from '@/components/logo';
import { AuroraBg } from '@/components/three-d';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Хянах самбар', icon: LayoutDashboard, perm: 'reports.read' },
  { href: '/applications', label: 'Зээлийн хүсэлт', icon: FileCheck2, perm: 'applications.read' },
  { href: '/loans', label: 'Зээлүүд', icon: Wallet, perm: 'loans.read' },
  { href: '/users', label: 'Хэрэглэгчид', icon: Users, perm: 'users.read' },
  { href: '/products', label: 'Бүтээгдэхүүн', icon: Boxes, perm: 'products.read' },
  { href: '/reports', label: 'Тайлан', icon: BarChart3, perm: 'reports.read' },
  { href: '/notifications', label: 'Мэдэгдэл', icon: Bell, perm: 'notifications.write' },
  { href: '/audit', label: 'Аудит лог', icon: ScrollText, perm: 'audit.read' },
  { href: '/settings', label: 'Тохиргоо', icon: Settings, perm: null },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('orgil-theme', next ? 'dark' : 'light'); } catch { /* storage unavailable */ }
    setDark(next);
  };
  return <Button variant="ghost" size="icon" onClick={toggle} aria-label="Харагдах байдал">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>;
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, can } = useAdmin();
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState('');
  useEffect(() => setOpen(false), [pathname]);
  // Client-only: server and browser locales differ, so rendering this on the server causes a hydration mismatch.
  useEffect(() => {
    const d = new Date();
    setToday(`${d.getFullYear()} оны ${d.getMonth() + 1}-р сарын ${d.getDate()}`);
  }, []);
  // Send staff without dashboard access to the first page their role allows.
  useEffect(() => {
    if (me && pathname === '/' && !can('reports.read')) {
      const first = NAV.find((n) => n.perm && can(n.perm));
      router.replace(first?.href ?? '/settings');
    }
  }, [me, pathname, can, router]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };
  const items = NAV.filter((n) => !n.perm || can(n.perm));

  return (
    <div className="min-h-screen">
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden bg-gradient-to-b from-[#14161F] via-[#14161F] to-[#1F1718] p-5 transition-transform lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <AuroraBg className="opacity-40" />
        <div className="relative flex items-center justify-between"><Logo light /><button className="text-white/60 lg:hidden" onClick={() => setOpen(false)} aria-label="Хаах"><X className="h-5 w-5" /></button></div>
        <nav className="relative mt-8 flex-1 space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={cn('flex items-center gap-3 rounded-xl2 px-3 py-2.5 text-sm font-semibold transition', active ? 'bg-gradient-to-r from-[#FF5533] to-[#FF8A4C] text-white shadow-[0_10px_30px_-8px_rgba(255,85,51,0.8)]' : 'text-white/60 hover:bg-white/10 hover:text-white')}>
                <Icon className="h-[18px] w-[18px]" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="relative rounded-xl2 border border-white/10 bg-white/10 p-3 backdrop-blur">
          <div className="truncate text-sm font-semibold text-white">{me?.name ?? '…'}</div>
          <div className="truncate text-xs text-white/50">{me?.role}</div>
          <button onClick={logout} className="mt-3 flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white"><LogOut className="h-3.5 w-3.5" /> Гарах</button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-navy/40 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/60 bg-white/45 px-4 backdrop-blur-xl dark:border-white/5 dark:bg-canvas-dark/50 sm:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Цэс"><Menu className="h-5 w-5" /></Button>
          <div className="hidden text-xs text-ink-muted sm:block">{today}</div>
          <div className="flex items-center gap-2">
            {me && !me.mfaEnabled && <Link href="/settings?tab=security" className="hidden rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-amber-700 sm:block">MFA идэвхжүүлнэ үү</Link>}
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function DashLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <Shell>{children}</Shell>
    </AdminProvider>
  );
}
