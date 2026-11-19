'use client';
import { ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Logo } from '@/components/logo';
import { AuroraBg, IsoScene, TiltCard } from '@/components/three-d';
import { Button } from '@/components/ui/button';
import { ErrorBox, Field, Input } from '@/components/ui/primitives';

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(mfaToken ? '/api/auth/mfa' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mfaToken ? { mfaToken, code } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Нэвтрэх боломжгүй');
      if (data.mfaRequired) {
        setMfaToken(data.mfaToken);
        return;
      }
      router.replace(next.startsWith('/') ? next : '/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!mfaToken ? (
        <>
          <Field label="И-мэйл"><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
          <Field label="Нууц үг"><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        </>
      ) : (
        <Field label="Баталгаажуулах код (Authenticator)" hint="Authenticator апп дахь 6 оронтой кодыг оруулна уу">
          <Input inputMode="numeric" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required className="text-center text-lg tracking-[0.5em]" />
        </Field>
      )}
      <ErrorBox error={error} />
      <Button type="submit" size="lg" className="w-full" loading={loading}>{mfaToken ? 'Баталгаажуулах' : 'Нэвтрэх'}</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0B0C12] via-[#3A1D17] to-[#E0451F] p-12 lg:flex lg:flex-col lg:justify-between">
        <AuroraBg />
        <div className="relative"><Logo light /></div>
        <TiltCard max={10} className="relative mx-auto w-full max-w-md"><IsoScene className="w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.4)]" /></TiltCard>
        <div className="relative space-y-4">
          <h1 className="font-display text-4xl font-extrabold leading-tight text-white">Зээлийн үйл ажиллагааг<br />нэг дороос удирдах</h1>
          <p className="max-w-md text-sm text-white/60">Хүсэлт хянах, бүтээгдэхүүн тохируулах, эргэн төлөлт болон тайланг аюулгүй, хяналттай орчинд.</p>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-white/50"><ShieldCheck className="h-4 w-4 text-mint" /> Бүх үйлдэл аудитын бүртгэлд хадгалагдана</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="font-display text-2xl font-extrabold text-ink dark:text-ink-inverse">Нэвтрэх</h2>
          <p className="mb-6 mt-1 text-sm text-ink-muted">Ажилтны бүртгэлээр нэвтэрнэ үү</p>
          <Suspense><LoginForm /></Suspense>
        </div>
      </div>
    </div>
  );
}
