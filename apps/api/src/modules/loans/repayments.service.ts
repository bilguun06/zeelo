import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { applyPayment, dec, money, sum, toMoneyString, totalOf, remainingOf } from '@orgil/financial-engine';
import { formatMNT } from '@orgil/shared';
import { AuditService } from '../../common/audit.service';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { toDec } from '../../common/serialize';
import { NotificationsService } from '../notifications/notifications.service';
import { LedgerService } from '../transactions/ledger.service';
import { toInstallmentState } from './loans.mapper';

/**
 * Applies a VERIFIED payment to a loan. Called only by the payment layer after the provider
 * confirms the funds (callback + verification). Idempotent per payment intent.
 */
@Injectable()
export class RepaymentsService {
  private readonly logger = new Logger(RepaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async settleIntent(intentId: string, paidAt = new Date()) {
    return this.prisma.money(async (tx) => {
      const intent = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intentId }, include: { repayment: true } });
      if (intent.repayment) return intent.repayment; // idempotent: already applied
      if (intent.status !== 'PAID') throw new ConflictException('Intent not paid');

      const loan = await tx.loan.findUniqueOrThrow({ where: { id: intent.loanId }, include: { schedule: true } });
      if (loan.status === 'COMPLETED') {
        // Funds arrived for a closed loan → must be refunded, never silently absorbed.
        if (!intent.failureReason) {
          const amount = dec(intent.amount.toString());
          await this.ledger.post(tx, { reference: `SUSP:${intent.id}`, description: 'Unapplied payment (loan closed)', loanId: loan.id, lines: [{ account: 'CASH_CLEARING', debit: amount }, { account: 'CUSTOMER_PAYABLE', credit: amount }] });
          await tx.paymentIntent.update({ where: { id: intent.id }, data: { failureReason: 'Loan already closed — refund required' } });
        }
        this.logger.warn(`Payment ${intent.id} received for closed loan ${loan.loanNo}; flagged for refund`);
        return null;
      }

      const states = loan.schedule.map(toInstallmentState);
      const result = applyPayment(states, intent.amount.toString(), paidAt, loan.disbursedAt);

      for (const a of result.allocations) {
        const row = loan.schedule.find((s) => s.installmentNo === a.installmentNo)!;
        const newPaid = {
          principalPaid: toDec(row.principalPaid).plus(a.principal),
          interestPaid: toDec(row.interestPaid).plus(a.interest),
          feePaid: toDec(row.feePaid).plus(a.fee),
          penaltyPaid: toDec(row.penaltyPaid).plus(a.penalty),
        };
        const waived = toDec(row.interestWaived).plus(a.interestWaived);
        const after = toInstallmentState({ ...row, ...mapDec(newPaid), interestWaived: new Prisma.Decimal(waived.toFixed(2)) });
        const settled = totalOf(remainingOf(after)).isZero();
        await tx.loanSchedule.update({
          where: { id: row.id },
          data: {
            principalPaid: toMoneyString(newPaid.principalPaid), interestPaid: toMoneyString(newPaid.interestPaid),
            feePaid: toMoneyString(newPaid.feePaid), penaltyPaid: toMoneyString(newPaid.penaltyPaid), interestWaived: toMoneyString(waived),
            status: settled ? 'PAID' : row.status === 'OVERDUE' ? 'OVERDUE' : 'PARTIAL',
            paidAt: settled ? paidAt : null,
          },
        });
      }

      const newOutstanding = money(toDec(loan.outstandingPrincipal).minus(result.totals.principal));
      const stillOverdue = !result.closesLoan && loan.schedule.some((s) => {
        const a = result.allocations.find((x) => x.installmentNo === s.installmentNo);
        return s.status === 'OVERDUE' && !(a?.fullySettled);
      });
      // Optimistic concurrency: version must match what we read.
      const updated = await tx.loan.updateMany({
        where: { id: loan.id, version: loan.version },
        data: {
          outstandingPrincipal: toMoneyString(newOutstanding),
          status: result.closesLoan ? 'COMPLETED' : stillOverdue ? 'OVERDUE' : 'ACTIVE',
          closedAt: result.closesLoan ? paidAt : null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException({ message: 'Concurrent loan update, retry', code: 'RETRY' });
      if (result.closesLoan) await tx.loanApplication.update({ where: { id: loan.applicationId }, data: { status: 'COMPLETED' } });

      const repayment = await tx.loanRepayment.create({
        data: {
          receiptNo: this.crypto.reference('RC'),
          loanId: loan.id,
          userId: loan.userId,
          paymentIntentId: intent.id,
          provider: intent.provider,
          sandbox: intent.sandbox,
          amount: toMoneyString(result.amount),
          principalPart: toMoneyString(result.totals.principal),
          interestPart: toMoneyString(result.totals.interest),
          feePart: toMoneyString(result.totals.fee),
          penaltyPart: toMoneyString(result.totals.penalty),
          interestWaived: toMoneyString(result.totalInterestWaived),
          allocation: result.allocations.map((a) => ({
            installmentNo: a.installmentNo, principal: a.principal.toFixed(2), interest: a.interest.toFixed(2), fee: a.fee.toFixed(2),
            penalty: a.penalty.toFixed(2), interestWaived: a.interestWaived.toFixed(2),
          })),
          paidAt,
        },
      });

      const journal = await this.ledger.post(tx, {
        reference: `RPMT:${repayment.receiptNo}`,
        description: `Repayment ${loan.loanNo}${intent.sandbox ? ' [SANDBOX]' : ''}`,
        loanId: loan.id,
        lines: [
          { account: 'CASH_CLEARING', debit: result.amount },
          { account: 'LOANS_RECEIVABLE', credit: result.totals.principal },
          { account: 'INTEREST_INCOME', credit: result.totals.interest },
          { account: 'FEE_INCOME', credit: result.totals.fee },
          { account: 'PENALTY_INCOME', credit: result.totals.penalty },
        ],
      });
      await this.ledger.record(tx, {
        userId: loan.userId, loanId: loan.id, type: 'REPAYMENT', direction: 'DEBIT', amount: result.amount,
        description: `Зээлийн төлөлт ${loan.loanNo}${intent.sandbox ? ' (туршилт)' : ''}`, referenceType: 'LoanRepayment', referenceId: repayment.id, journalId: journal.id,
      });
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { reconciledAt: new Date() } });
      await this.audit.log({ actorType: 'SYSTEM', action: 'loan.repayment', entityType: 'Loan', entityId: loan.id, after: { receiptNo: repayment.receiptNo, amount: result.amount.toFixed(2), closes: result.closesLoan } }, tx);
      await this.notifications.notify(loan.userId, 'PAYMENT_SUCCESS', { loanNo: loan.loanNo, amount: formatMNT(result.amount.toFixed(2)), receiptNo: repayment.receiptNo }, { loanId: loan.id, repaymentId: repayment.id }, tx);
      // Sanity: allocated parts must equal the amount.
      const parts = sum([result.totals.principal, result.totals.interest, result.totals.fee, result.totals.penalty]);
      if (!parts.eq(dec(result.amount))) throw new Error('Allocation mismatch');
      return repayment;
    });
  }
}

function mapDec(o: Record<string, ReturnType<typeof dec>>) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, new Prisma.Decimal(v.toFixed(2))])) as Record<string, Prisma.Decimal>;
}
