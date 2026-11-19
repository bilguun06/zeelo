import type { AuthTokens } from '@orgil/shared';
import { Platform } from 'react-native';

const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_URL).replace(/\/$/, '');
const BASE = `${API_URL}/api/v1`;

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public body?: Record<string, unknown>) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onTokens: (t: AuthTokens | null) => void = () => {};

export function configureAuth(handler: (t: AuthTokens | null) => void) {
  onTokens = handler;
}
export function setTokens(t: { accessToken: string; refreshToken: string } | null) {
  accessToken = t?.accessToken ?? null;
  refreshToken = t?.refreshToken ?? null;
}
export const getAccessToken = () => accessToken;

/** Single-flight refresh: concurrent 401s share one rotation request. */
async function refresh(): Promise<boolean> {
  if (!refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
      if (!res.ok) throw new Error('refresh failed');
      const t = (await res.json()) as AuthTokens;
      setTokens(t);
      onTokens(t);
      return true;
    } catch {
      setTokens(null);
      onTokens(null);
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, 'network', 'NETWORK');
  }

  if (res.status === 401 && opts.auth !== false && !retried && (await refresh())) return api<T>(path, opts, true);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? (data.message as string[]).join('\n') : String(data.message ?? res.statusText);
    throw new ApiError(res.status, msg, data.code as string | undefined, data);
  }
  return data as T;
}
