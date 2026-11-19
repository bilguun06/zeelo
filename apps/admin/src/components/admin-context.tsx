'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { useApi } from '@/lib/api';

export interface AdminMe { id: string; email: string; name: string; role: string; permissions: string[]; mfaEnabled: boolean }

const Ctx = createContext<{ me: AdminMe | null; can: (p: string) => boolean; reload: () => void }>({ me: null, can: () => false, reload: () => {} });

export function AdminProvider({ children }: { children: ReactNode }) {
  const { data, mutate } = useApi<AdminMe>('auth/me');
  const me = data ?? null;
  return <Ctx.Provider value={{ me, can: (p) => Boolean(me?.permissions.includes(p)), reload: () => void mutate() }}>{children}</Ctx.Provider>;
}

export const useAdmin = () => useContext(Ctx);

/** Hides UI the current admin is not permitted to use (the API enforces it regardless). */
export function Can({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAdmin();
  return can(perm) ? <>{children}</> : null;
}
