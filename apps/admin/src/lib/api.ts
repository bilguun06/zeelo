'use client';
import useSWR, { type SWRConfiguration } from 'swr';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public body?: unknown) {
    super(message);
  }
}

async function parse(res: Response) {
  const text = await res.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith('/login')) {
      location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    }
    const msg = body && typeof body === 'object' ? (Array.isArray(body.message) ? body.message.join(', ') : body.message) : res.statusText;
    throw new ApiError(res.status, msg || 'Request failed', body?.code, body);
  }
  return body;
}

/** Calls the API through the same-origin proxy (path is relative to /api/v1/admin). */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/proxy/admin/${path.replace(/^\//, '')}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  return parse(res) as Promise<T>;
}

export function useApi<T>(path: string | null, config?: SWRConfiguration) {
  return useSWR<T>(path, (p: string) => api<T>(p), { revalidateOnFocus: false, ...config });
}

/** Downloads a binary export (xlsx/pdf) via the proxy. */
export async function download(path: string) {
  const res = await fetch(`/api/proxy/admin/${path}`);
  if (!res.ok) await parse(res);
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'export';
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
}

export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
