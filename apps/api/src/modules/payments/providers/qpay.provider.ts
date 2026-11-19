import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { env } from '../../../config/env';
import { CacheService } from '../../../common/cache.service';
import type { InvoiceRequest, InvoiceResult, PaymentProviderAdapter, VerificationResult } from './payment-provider';

/**
 * QPay merchant API v2 adapter (invoice → QR/deeplinks → payment/check).
 * Disabled until merchant credentials are configured. Written against QPay's published v2
 * endpoints but NOT yet certified against a live merchant account — verify field names and
 * callback behaviour in QPay's sandbox before enabling in production.
 */
@Injectable()
export class QPayProvider implements PaymentProviderAdapter {
  readonly code = 'QPAY' as const;
  readonly sandbox = false;
  private readonly logger = new Logger('QPay');

  constructor(private readonly cache: CacheService) {}

  isEnabled() {
    const e = env();
    return Boolean(e.QPAY_BASE_URL && e.QPAY_USERNAME && e.QPAY_PASSWORD && e.QPAY_INVOICE_CODE);
  }

  private async token(): Promise<string> {
    const cached = await this.cache.get<string>('qpay:token');
    if (cached) return cached;
    const e = env();
    const res = await fetch(`${e.QPAY_BASE_URL}/v2/auth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${e.QPAY_USERNAME}:${e.QPAY_PASSWORD}`).toString('base64')}` },
    });
    if (!res.ok) throw new ServiceUnavailableException('QPay authentication failed');
    const body = (await res.json()) as { access_token: string; expires_in?: number };
    await this.cache.set('qpay:token', body.access_token, Math.max(60, (body.expires_in ?? 3600) - 120));
    return body.access_token;
  }

  private async call<T>(path: string, payload: unknown): Promise<T> {
    const res = await fetch(`${env().QPAY_BASE_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      this.logger.error(`QPay ${path} → HTTP ${res.status}`);
      throw new ServiceUnavailableException('Payment provider error');
    }
    return (await res.json()) as T;
  }

  async createInvoice(req: InvoiceRequest): Promise<InvoiceResult> {
    if (!this.isEnabled()) throw new ServiceUnavailableException('QPay is not configured');
    const r = await this.call<{ invoice_id: string; qr_text: string; urls?: { name: string; link: string }[] }>('/v2/invoice', {
      invoice_code: env().QPAY_INVOICE_CODE,
      sender_invoice_no: req.intentId,
      invoice_receiver_code: 'terminal',
      invoice_description: req.description,
      amount: Number(req.amount), // QPay expects a JSON number; amounts are whole/2dp MNT so this is exact
      callback_url: req.callbackUrl,
    });
    return { providerRef: r.invoice_id, qrText: r.qr_text, deeplinks: (r.urls ?? []).map((u) => ({ name: u.name, link: u.link })) };
  }

  async verify(providerRef: string): Promise<VerificationResult> {
    const r = await this.call<{ count: number; paid_amount?: number; rows?: { payment_id: string; payment_status: string; payment_amount: string; payment_date?: string }[] }>(
      '/v2/payment/check',
      { object_type: 'INVOICE', object_id: providerRef, offset: { page_number: 1, page_limit: 100 } },
    );
    const paid = r.rows?.find((x) => x.payment_status === 'PAID');
    if (!paid) return { status: 'PENDING', raw: r };
    return { status: 'PAID', paidAmount: String(paid.payment_amount), paidAt: paid.payment_date ? new Date(paid.payment_date) : new Date(), paymentId: paid.payment_id, raw: r };
  }

  async refund(_providerRef: string, paymentId: string | undefined) {
    if (!paymentId) return { ok: false };
    const res = await fetch(`${env().QPAY_BASE_URL}/v2/payment/refund/${encodeURIComponent(paymentId)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${await this.token()}` },
    });
    return { ok: res.ok, reference: paymentId };
  }
}
