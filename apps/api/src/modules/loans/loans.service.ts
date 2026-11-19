import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LoanStatus, Prisma } from '@prisma/client';
import {
  buildSchedule, calculatePenalty, calculateServiceFee, dec, money, type PricingTerms, remainingOf, toMoneyString, totalOf,
} from '@orgil/financial-engine';
import { formatDate, formatMNT } from '@orgil/shared';
import { AuditService } from '../../common/audit.service';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { toDec } from '../../common/serialize';
import { NotificationsService } from '../notifications/notifications.service';
import { LedgerService } from '../transactions/ledger.service';
import { toInstallmentState, toLoanDetail, toLoanDto } from './loans.mapper';

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  async listForUser(userId: string, status?: 'active' | 'completed') {
    const where: Prisma.LoanWhereInput = { userId };
    if (status === 'active') where.status = { in: ['ACTIVE', 'OVERDUE'] };
    if (status === 'completed') where.status = { in: ['COMPLETED', 'WRITTEN_OFF'] };
    const loans = await this.prisma.loan.findMany({ where, include: { schedule: true, product: true }, orderBy: { disbursedAt: 'desc' } });
    return loans.map((l) => toLoanDto(l));
  }

  async detailForUser(userId: string, loanId: string) {
    const loan = await this.prisma.loan.findFirst({ where: { id: loanId, userId }, include: { schedule: true, product: true, repayments: true } });
    if (!loan) throw new NotFoundException();
    return toLoanDetail(loan);
  }

  /**
   * Books an approved application as a loan AFTER funds have been sent to the customer's bank
   * account. The operator records the bank transfer reference; this service never moves money.
   * (Integration point: automated payout via a bank API once a contract exists.)
   */
  async disburse(applicationId: string, adminId: string, payoutReference: string) {
    const loan = await this.prisma.money(async (tx) => {
      const app = await tx.loanApplication.findUnique({
        where: { id: applicationId },
        include: { approvals: { orderBy: { createdAt: 'desc' }, take: 1 }, bankAccount: true, loan: true },
      });
      if (!app) throw new NotFoundException();
      if (app.loan) throw new ConflictException({ message: 'Application already disbursed', code: 'ALREADY_DISBURSED' });
      if (app.status !== 'APPROVED') throw new BadRequestException({ message: `Cannot disburse application in status ${app.status}`, code: 'INVALID_STATUS' });
      if (!app.bankAccount) throw new BadRequestException({ message: 'No payout bank account on application', code: 'NO_BANK_ACCOUNT' });

      const approval = app.approvals[0];
      const principal = money(approval?.approvedAmount?.toString() ?? app.amount.toString());
      const termMonths = approval?.approvedTermMonths ?? app.termMonths;
      const terms = app.termsSnapshot as unknown as PricingTerms & { penaltyRateDaily: string };
      const disbursedAt = new Date();
      const lines = buildSchedule({ ...terms, principal, termMonths, startDate: disbursedAt });
      const fee = calculateServiceFee(principal, terms.serviceFeePercent, terms.serviceFeeFixed);
      const deducted = terms.feeCollection === 'DEDUCTED_FROM_DISBURSEMENT';
      const net = deducted ? principal.minus(fee) : principal;

      const created = await tx.loan.create({
        data: {
          loanNo: this.crypto.reference('LN'),
          userId: app.userId,
          applicationId: app.id,
          productId: app.productId,
          principal: toMoneyString(principal),
          monthlyInterestRate: dec(terms.monthlyInterestRate).toString(),
          serviceFee: toMoneyString(fee),
          feeCollection: terms.feeCollection,
          penaltyRateDaily: dec(terms.penaltyRateDaily ?? 0).toString(),
          termMonths,
          repaymentMethod: terms.repaymentMethod,
          outstandingPrincipal: toMoneyString(principal),
          disbursedAt,
          maturityDate: lines[lines.length - 1].dueDate,
          schedule: {
            create: lines.map((l) => ({
              installmentNo: l.installmentNo, dueDate: l.dueDate, principalDue: toMoneyString(l.principal),
              interestDue: toMoneyString(l.interest), feeDue: toMoneyString(l.fee),
            })),
          },
        },
      });

      const journal = await this.ledger.post(tx, {
        reference: `DISB:${created.loanNo}:${payoutReference}`,
        description: `Disbursement ${created.loanNo}`,
        loanId: created.id,
        lines: [
          { account: 'LOANS_RECEIVABLE', debit: principal },
          { account: 'CASH_CLEARING', credit: net },
          ...(deducted ? [{ account: 'FEE_INCOME' as const, credit: fee }] : []),
        ],
      });
      await this.ledger.record(tx, { userId: app.userId, loanId: created.id, type: 'DISBURSEMENT', direction: 'CREDIT', amount: net, description: `Зээл олголт ${created.loanNo}`, referenceType: 'Loan', referenceId: created.id, journalId: journal.id });
      if (deducted) await this.ledger.record(tx, { userId: app.userId, loanId: created.id, type: 'FEE', direction: 'DEBIT', amount: fee, description: `Үйлчилгээний шимтгэл ${created.loanNo}`, referenceType: 'Loan', referenceId: created.id, journalId: journal.id });

      await tx.loanApplication.update({ where: { id: app.id }, data: { status: 'DISBURSED' } });
      await tx.applicationHistory.create({ data: { applicationId: app.id, fromStatus: 'APPROVED', toStatus: 'DISBURSED', actorType: 'ADMIN', actorId: adminId, note: `Payout ref ${payoutReference}` } });
      await this.audit.log({ actorType: 'ADMIN', actorId: adminId, action: 'loan.disburse', entityType: 'Loan', entityId: created.id, after: { principal: principal.toFixed(2), net: net.toFixed(2), payoutReference } }, tx);
      await this.notifications.notify(app.userId, 'LOAN_DISBURSED', {
        amount: formatMNT(net.toFixed(2)), account: `•••• ${app.bankAccount.accountLast4}`, firstDue: formatDate(lines[0].dueDate),
      }, { loanId: created.id }, tx);
      return created;
    });
    return loan;
  }

  /**
   * Daily job: marks overdue installments/loans and recomputes penalties idempotently.
   * Safe to run multiple times per day.
   */
  async refreshOverdue(asOf = new Date()) {
    const capPercent = await this.settings.get<string>('loans.penalty_cap_percent');
    const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
    const overdue = await this.prisma.loanSchedule.findMany({
      where: { dueDate: { lt: today }, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] }, loan: { status: { in: ['ACTIVE', 'OVERDUE'] } } },
      include: { loan: { select: { id: true, penaltyRateDaily: true, userId: true, loanNo: true } } },
    });
    const loanIds = new Set<string>();
    for (const s of overdue) {
      const state = toInstallmentState(s);
      if (totalOf(remainingOf(state)).isZero()) continue;
      const penalty = calculatePenalty(state, s.loan.penaltyRateDaily.toString(), asOf, capPercent);
      await this.prisma.loanSchedule.update({ where: { id: s.id }, data: { status: 'OVERDUE', penaltyDue: toMoneyString(penalty) } });
      loanIds.add(s.loan.id);
    }
    if (loanIds.size) await this.prisma.loan.updateMany({ where: { id: { in: [...loanIds] }, status: 'ACTIVE' }, data: { status: LoanStatus.OVERDUE } });
    this.logger.log(`Overdue refresh: ${overdue.length} installments across ${loanIds.size} loans`);
    return { installments: overdue.length, loans: loanIds.size };
  }

  /** Sends due-soon reminders once per installment, and weekly overdue reminders. */
  async sendReminders(asOf = new Date()) {
    const daysBefore = Number(await this.settings.get<number>('loans.reminder_days_before'));
    const horizon = new Date(asOf.getTime() + daysBefore * 86_400_000);
    const upcoming = await this.prisma.loanSchedule.findMany({
      where: { dueDate: { gte: asOf, lte: horizon }, status: { in: ['PENDING', 'PARTIAL'] }, reminderSentAt: null, loan: { status: 'ACTIVE' } },
      include: { loan: { select: { userId: true, loanNo: true, id: true } } },
    });
    for (const s of upcoming) {
      const amount = totalOf(remainingOf(toInstallmentState(s)));
      await this.notifications.notify(s.loan.userId, 'DUE_SOON', { loanNo: s.loan.loanNo, amount: formatMNT(amount.toFixed(2)), dueDate: formatDate(s.dueDate) }, { loanId: s.loan.id });
      await this.prisma.loanSchedule.update({ where: { id: s.id }, data: { reminderSentAt: new Date() } });
    }
    const weekAgo = new Date(asOf.getTime() - 7 * 86_400_000);
    const overdue = await this.prisma.loanSchedule.findMany({
      where: { status: 'OVERDUE', OR: [{ reminderSentAt: null }, { reminderSentAt: { lt: weekAgo } }] },
      include: { loan: { select: { userId: true, loanNo: true, id: true } } },
    });
    for (const s of overdue) {
      const days = Math.floor((asOf.getTime() - s.dueDate.getTime()) / 86_400_000);
      await this.notifications.notify(s.loan.userId, 'REPAYMENT_REMINDER', { loanNo: s.loan.loanNo, days }, { loanId: s.loan.id });
      await this.prisma.loanSchedule.update({ where: { id: s.id }, data: { reminderSentAt: new Date() } });
    }
    return { dueSoon: upcoming.length, overdue: overdue.length };
  }

  /** Sum of outstanding principal across a user's open loans. */
  async usedLimit(userId: string) {
    const agg = await this.prisma.loan.aggregate({ where: { userId, status: { in: ['ACTIVE', 'OVERDUE'] } }, _sum: { outstandingPrincipal: true } });
    return toDec(agg._sum.outstandingPrincipal);
  }
}
