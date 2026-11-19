import type {
  ApplicationDto, BankAccountDto, DashboardDto, LoanDetailDto, LoanDto, LoanProductDto, MeDto, NotificationDto, Paginated, TransactionDto,
} from '@orgil/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export const qk = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  products: ['products'] as const,
  loans: (s?: string) => ['loans', s ?? 'all'] as const,
  loan: (id: string) => ['loan', id] as const,
  applications: ['applications'] as const,
  application: (id: string) => ['application', id] as const,
  transactions: (f: string) => ['transactions', f] as const,
  notifications: ['notifications'] as const,
  bankAccounts: ['bank-accounts'] as const,
  kyc: ['kyc'] as const,
};

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: () => api<MeDto>('/me') });
export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: () => api<DashboardDto>('/me/dashboard') });
export const useProducts = () => useQuery({ queryKey: qk.products, queryFn: () => api<LoanProductDto[]>('/products', { auth: false }), staleTime: 5 * 60_000 });
export const useLoans = (status?: 'active' | 'completed') => useQuery({ queryKey: qk.loans(status), queryFn: () => api<LoanDto[]>(`/loans${status ? `?status=${status}` : ''}`) });
export const useLoan = (id: string) => useQuery({ queryKey: qk.loan(id), queryFn: () => api<LoanDetailDto>(`/loans/${id}`) });
export const useApplications = () => useQuery({ queryKey: qk.applications, queryFn: () => api<ApplicationDto[]>('/applications') });
export const useApplication = (id: string) => useQuery({ queryKey: qk.application(id), queryFn: () => api<ApplicationDto>(`/applications/${id}`), refetchInterval: 15_000 });
export const useBankAccounts = () => useQuery({ queryKey: qk.bankAccounts, queryFn: () => api<BankAccountDto[]>('/me/bank-accounts') });
export const useNotifications = () =>
  useQuery({ queryKey: qk.notifications, queryFn: () => api<Paginated<NotificationDto> & { unread: number }>('/notifications?pageSize=50') });
export const useTransactions = (filter: { type?: string; from?: string }) => {
  const q = new URLSearchParams({ pageSize: '100', ...(filter.type ? { type: filter.type } : {}), ...(filter.from ? { from: filter.from } : {}) }).toString();
  return useQuery({ queryKey: qk.transactions(q), queryFn: () => api<Paginated<TransactionDto>>(`/transactions?${q}`) });
};
export interface KycStatus { status: string; documents: { type: string; uploaded: boolean; status: string | null }[] }
export const useKyc = () => useQuery({ queryKey: qk.kyc, queryFn: () => api<KycStatus>('/kyc/status') });
