import { Injectable } from '@nestjs/common';
import { env } from '../../../config/env';
import { CacheService } from '../../../common/cache.service';
import { CryptoService } from '../../../common/crypto.service';
import type { InvoiceRequest, InvoiceResult, PaymentProviderAdapter, VerificationResult } from './payment-provider';

/**
 * SANDBOX provider for development and QA. It represents NO real money: payments only become
 * "paid" when a tester explicitly confirms them, and every resulting repayment, receipt and
 * ledger journal is flagged sandbox. Automatically disabled when NODE_ENV=production.
 */
@Injectable()
export class SandboxPaymentProvider implements PaymentProviderAdapter {
  readonly code = 'SANDBOX' as const;
  readonly sandbox = true;

  constructor(private readonly cache: CacheService, private readonly crypto: CryptoService) {}

  isEnabled() {
    return env().PAYMENT_SANDBOX_ENABLED;
  }

  async createInvoice(req: InvoiceRequest): Promise<InvoiceResult> {
    const providerRef = `SBX-${this.crypto.token(9)}`;
    await this.cache.set(`sbx:${providerRef}`, { amount: req.amount, status: 'PENDING' }, 86_400);
    return { providerRef, qrText: `ORGIL-SANDBOX|${providerRef}|${req.amount}|NOT-REAL-MONEY`, deeplinks: [] };
  }

  /** Tester action — the only way a sandbox invoice becomes paid. */
  async markPaid(providerRef: string) {
    const rec = await this.cache.get<{ amount: string; status: string }>(`sbx:${providerRef}`);
    if (!rec) return false;
    await this.cache.set(`sbx:${providerRef}`, { ...rec, status: 'PAID', paidAt: new Date().toISOString() }, 86_400);
    return true;
  }

  async verify(providerRef: string): Promise<VerificationResult> {
    const rec = await this.cache.get<{ amount: string; status: 'PAID' | 'PENDING'; paidAt?: string }>(`sbx:${providerRef}`);
    if (!rec) return { status: 'FAILED' };
    return { status: rec.status, paidAmount: rec.amount, paidAt: rec.paidAt ? new Date(rec.paidAt) : undefined, paymentId: providerRef };
  }

  async refund(providerRef: string) {
    await this.cache.set(`sbx:${providerRef}`, { status: 'REFUNDED' }, 86_400);
    return { ok: true, reference: `SBX-RF-${this.crypto.token(6)}` };
  }
}
