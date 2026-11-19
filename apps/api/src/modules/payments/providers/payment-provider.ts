import type { PaymentProvider } from '@prisma/client';

export interface InvoiceRequest {
  intentId: string;
  amount: string;
  description: string;
  callbackUrl: string;
}

export interface InvoiceResult {
  providerRef: string;
  qrText?: string;
  deeplinks?: { name: string; link: string }[];
}

export interface VerificationResult {
  status: 'PAID' | 'PENDING' | 'FAILED';
  paidAmount?: string;
  paidAt?: Date;
  /** Provider-side payment id needed for refunds */
  paymentId?: string;
  raw?: unknown;
}

/**
 * Contract every payment provider adapter implements. The core never trusts a callback body:
 * callbacks only TRIGGER verification, and verify() asks the provider for the authoritative status.
 */
export interface PaymentProviderAdapter {
  readonly code: PaymentProvider;
  readonly sandbox: boolean;
  isEnabled(): boolean;
  createInvoice(req: InvoiceRequest): Promise<InvoiceResult>;
  verify(providerRef: string): Promise<VerificationResult>;
  refund(providerRef: string, paymentId: string | undefined, amount: string): Promise<{ ok: boolean; reference?: string }>;
}

export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
