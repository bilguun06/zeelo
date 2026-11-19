import {
  BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, UnprocessableEntityException,
} from '@nestjs/common';
import { PaymentIntent, PaymentProvider } from '@prisma/client';
import { computePayoff, dec, money, toMoneyString } from '@orgil/financial-engine';
import type { PaymentIntentDto } from '@orgil/shared';
import { env } from '../../config/env';
import { AuditService } from '../../common/audit.service';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { m } from '../../common/serialize';
import { SettingsService } from '../../common/settings.service';
import { toInstallmentState } from '../loans/loans.mapper';
import { RepaymentsService } from '../loans/repayments.service';
import { LedgerService } from '../transactions/ledger.service';
import { PAYMENT_PROVIDERS, type PaymentProviderAdapter } from './providers/payment-provider';
import { SandboxPaymentProvider } from './providers/sandbox.provider';

const OPEN: PaymentIntent['status'][] = ['CREATED', 'PENDING'];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly repayments: RepaymentsService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly sandboxProvider: SandboxPaymentProvider,
    @Inject(PAYMENT_PROVIDERS) private readonly adapters: PaymentProviderAdapter[],
  ) {}

  private adapter(code: PaymentProvider): PaymentProviderAdapter {
    const a = this.adapters.find((x) => x.code === code);
    if (!a) throw new BadRequestException('Unknown provider');
    return a;
  }

  availableProviders() {
    return this.adapters.map((a) => ({ code: a.code, enabled: a.isEnabled(), sandbox: a.sandbox }));
  }

  toDto(i: PaymentIntent & { repayment?: { id: string } | null }): PaymentIntentDto {
    return {
      id: i.id, loanId: i.loanId, amount: m(i.amount), provider: i.provider, status: i.status, qrText: i.qrText,
      deeplinks: (i.deeplinks as { name: string; link: string }[] | null) ?? [], expiresAt: i.expiresAt.toISOString(),
      sandbox: i.sandbox, repaymentId: i.repayment?.id ?? null,
    };
  }

  callbackSignature(intentId: string) {
    return this.crypto.hmac(env().PAYMENT_WEBHOOK_SECRET, intentId);
  }

  /** Creates (or idempotently returns) a payment invoice for a loan repayment. */
  async createIntent(userId: string, input: { loanId: string; amount: string; provider: PaymentProvider }, idempotencyKey: string) {
    if (!/^[\w-]{16,80}$/.test(idempotencyKey ?? '')) throw new BadRequestException({ message: 'Idempotency-Key header (16–80 chars) is required', code: 'IDEMPOTENCY_KEY' });

    const existing = await this.prisma.paymentIntent.findUnique({ where: { idempotencyKey }, include: { repayment: { select: { id: true } } } });
    if (existing) {
      if (existing.userId !== userId || existing.loanId !== input.loanId || !dec(existing.amount.toString()).eq(dec(input.amount))) {
        throw new ConflictException({ message: 'Idempotency key reused with different parameters', code: 'IDEMPOTENCY_CONFLICT' });
      }
      return this.toDto(existing);
    }

    const adapter = this.adapter(input.provider);
    if (!adapter.isEnabled()) throw new UnprocessableEntityException({ message: `${input.provider} is not available`, code: 'PROVIDER_UNAVAILABLE' });

    const loan = await this.prisma.loan.findFirst({ where: { id: input.loanId, userId }, include: { schedule: true } });
    if (!loan) throw new NotFoundException();
    if (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE') throw new UnprocessableEntityException({ message: 'Loan is not open', code: 'LOAN_CLOSED' });
    const amount = money(input.amount);
    const { payoff } = computePayoff(loan.schedule.map(toInstallmentState), new Date(), loan.disbursedAt);
    if (amount.lte(0) || amount.gt(payoff)) throw new UnprocessableEntityException({ message: `Amount must be between 0.01 and ${payoff.toFixed(2)}`, code: 'AMOUNT_INVALID', max: payoff.toFixed(2) });

    const ttl = Number(await this.settings.get<number>('payments.intent_ttl_minutes'));
    const intent = await this.prisma.paymentIntent.create({
      data: {
        userId, loanId: loan.id, amount: toMoneyString(amount), provider: input.provider, sandbox: adapter.sandbox,
        idempotencyKey, expiresAt: new Date(Date.now() + ttl * 60_000),
      },
    });
    try {
      const invoice = await adapter.createInvoice({
        intentId: intent.id,
        amount: toMoneyString(amount),
        description: `Orgil ${loan.loanNo}`,
        callbackUrl: `${env().PUBLIC_API_URL}/api/v1/payments/callbacks/${input.provider.toLowerCase()}?intent=${intent.id}&sig=${this.callbackSignature(intent.id)}`,
      });
      const updated = await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'PENDING', providerRef: invoice.providerRef, qrText: invoice.qrText, deeplinks: invoice.deeplinks ?? [] },
      });
      await this.audit.log({ actorType: 'USER', actorId: userId, action: 'payment.intent_created', entityType: 'PaymentIntent', entityId: intent.id, after: { amount: amount.toFixed(2), provider: input.provider } });
      return this.toDto(updated);
    } catch (e) {
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED', failureReason: (e as Error).message.slice(0, 200) } });
      throw e;
    }
  }

  async getForUser(userId: string, id: string) {
    let intent = await this.prisma.paymentIntent.findFirst({ where: { id, userId }, include: { repayment: { select: { id: true } } } });
    if (!intent) throw new NotFoundException();
    if (OPEN.includes(intent.status)) {
      await this.verifyAndSettle(intent.id);
      intent = await this.prisma.paymentIntent.findUniqueOrThrow({ where: { id }, include: { repayment: { select: { id: true } } } });
    }
    return this.toDto(intent);
  }

  /** Callback entry point. The signature only proves the call is for our intent; status is verified with the provider. */
  async handleCallback(provider: PaymentProvider, intentId: string, sig: string, payload: unknown) {
    if (!intentId || !sig || !this.crypto.safeEqual(sig, this.callbackSignature(intentId))) throw new ForbiddenException('Bad signature');
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent || intent.provider !== provider) throw new NotFoundException();
    await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { callbackCount: { increment: 1 }, lastCallback: (payload ?? {}) as object } });
    await this.verifyAndSettle(intent.id);
    return { ok: true };
  }

  /** Tester-only: confirm a SANDBOX invoice. Never available in production. */
  async sandboxConfirm(userId: string, intentId: string) {
    if (!env().PAYMENT_SANDBOX_ENABLED) throw new ForbiddenException('Sandbox disabled');
    const intent = await this.prisma.paymentIntent.findFirst({ where: { id: intentId, userId, provider: 'SANDBOX' } });
    if (!intent?.providerRef) throw new NotFoundException();
    await this.sandboxProvider.markPaid(intent.providerRef);
    await this.verifyAndSettle(intent.id);
    return this.getForUser(userId, intentId);
  }

  async verifyAndSettle(intentId: string) {
    const intent = await this.prisma.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });
    if (intent.status === 'PAID') {
      await this.repayments.settleIntent(intent.id, intent.paidAt ?? new Date());
      return;
    }
    if (!OPEN.includes(intent.status) || !intent.providerRef) return;
    const result = await this.adapter(intent.provider).verify(intent.providerRef);
    if (result.status === 'PENDING') {
      if (intent.expiresAt < new Date()) await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: { in: OPEN } }, data: { status: 'EXPIRED' } });
      return;
    }
    if (result.status === 'FAILED') {
      await this.prisma.paymentIntent.updateMany({ where: { id: intent.id, status: { in: OPEN } }, data: { status: 'FAILED', failureReason: 'Provider reported failure' } });
      return;
    }
    if (!result.paidAmount || !dec(result.paidAmount).eq(dec(intent.amount.toString()))) {
      await this.prisma.money(async (tx) => {
        const won = await tx.paymentIntent.updateMany({ where: { id: intent.id, status: { in: OPEN } }, data: { status: 'PAID', paidAt: result.paidAt ?? new Date(), failureReason: `Amount mismatch: paid ${result.paidAmount}` } });
        const received = dec(result.paidAmount ?? '0');
        if (won.count === 1 && received.gt(0)) {
          // Funds received but not applied → hold in customer payable until refunded or manually applied.
          await this.ledger.post(tx, { reference: `SUSP:${intent.id}`, description: 'Unapplied payment (amount mismatch)', loanId: intent.loanId, lines: [{ account: 'CASH_CLEARING', debit: received }, { account: 'CUSTOMER_PAYABLE', credit: received }] });
        }
      });
      this.logger.error(`Amount mismatch on intent ${intent.id} — manual reconciliation required`);
      return;
    }
    // Compare-and-set so concurrent callbacks settle exactly once.
    const won = await this.prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: { in: OPEN } },
      data: { status: 'PAID', paidAt: result.paidAt ?? new Date(), providerRef: intent.providerRef, lastCallback: { paymentId: result.paymentId ?? null } },
    });
    if (won.count === 1) await this.repayments.settleIntent(intent.id, result.paidAt ?? new Date());
  }

  /** Background: expire stale invoices and re-verify pending ones (catches missed callbacks). */
  async sweep() {
    const pending = await this.prisma.paymentIntent.findMany({ where: { status: { in: OPEN } }, take: 200, orderBy: { createdAt: 'asc' } });
    for (const p of pending) {
      try {
        if (this.adapter(p.provider).isEnabled()) await this.verifyAndSettle(p.id);
        else if (p.expiresAt < new Date()) await this.prisma.paymentIntent.update({ where: { id: p.id }, data: { status: 'EXPIRED' } });
      } catch (e) {
        this.logger.warn(`sweep ${p.id}: ${(e as Error).message}`);
      }
    }
    return { checked: pending.length };
  }

  /** Admin reconciliation view: paid-but-unapplied, mismatched or refund-required intents. */
  async reconciliation() {
    const rows = await this.prisma.paymentIntent.findMany({
      where: { OR: [{ status: 'PAID', repayment: null }, { failureReason: { not: null }, status: 'PAID' }] },
      include: { loan: { select: { loanNo: true } }, user: { select: { phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => ({ ...this.toDto(r), loanNo: r.loan.loanNo, phone: r.user.phone, failureReason: r.failureReason, paidAt: r.paidAt?.toISOString() ?? null }));
  }

  /** Refunds a paid intent that could not be applied (e.g. loan already closed, amount mismatch). */
  async refund(intentId: string, adminId: string) {
    const intent = await this.prisma.paymentIntent.findUniqueOrThrow({ where: { id: intentId }, include: { repayment: true } });
    if (intent.status !== 'PAID' || intent.repayment) throw new UnprocessableEntityException({ message: 'Only unapplied paid intents can be refunded', code: 'NOT_REFUNDABLE' });
    const paymentId = (intent.lastCallback as { paymentId?: string } | null)?.paymentId ?? undefined;
    const r = await this.adapter(intent.provider).refund(intent.providerRef ?? '', paymentId, intent.amount.toFixed(2));
    if (!r.ok) throw new UnprocessableEntityException({ message: 'Provider refused refund', code: 'REFUND_FAILED' });
    await this.prisma.money(async (tx) => {
      const amount = dec(intent.amount.toString());
      const journal = await this.ledger.post(tx, {
        reference: `RFND:${intent.id}`, description: `Refund of unapplied payment${intent.sandbox ? ' [SANDBOX]' : ''}`, loanId: intent.loanId,
        lines: [{ account: 'CUSTOMER_PAYABLE', debit: amount }, { account: 'CASH_CLEARING', credit: amount }],
      });
      await this.ledger.record(tx, { userId: intent.userId, loanId: intent.loanId, type: 'REFUND', direction: 'CREDIT', amount, description: 'Төлбөрийн буцаалт', referenceType: 'PaymentIntent', referenceId: intent.id, journalId: journal.id });
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'REFUNDED' } });
      await this.audit.log({ actorType: 'ADMIN', actorId: adminId, action: 'payment.refund', entityType: 'PaymentIntent', entityId: intent.id, after: { reference: r.reference } }, tx);
    });
    return { ok: true };
  }
}
