import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LedgerAccount, TransactionType, TxnDirection } from '@prisma/client';
import { dec, type Decimal, sum, toMoneyString } from '@orgil/financial-engine';
import { CryptoService } from '../../common/crypto.service';
import type { Tx } from '../../common/prisma.service';

export interface LedgerLineInput { account: LedgerAccount; debit?: Decimal; credit?: Decimal }

/**
 * Double-entry bookkeeping. Every journal must balance (Σ debit = Σ credit) or the whole
 * surrounding DB transaction is aborted. Ledger rows are append-only — corrections are new journals.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly crypto: CryptoService) {}

  async post(tx: Tx, input: { reference: string; description: string; loanId?: string; lines: LedgerLineInput[] }) {
    const lines = input.lines.filter((l) => (l.debit && !l.debit.isZero()) || (l.credit && !l.credit.isZero()));
    const debits = sum(lines.map((l) => l.debit ?? dec(0)));
    const credits = sum(lines.map((l) => l.credit ?? dec(0)));
    if (!debits.eq(credits) || debits.isZero()) {
      throw new InternalServerErrorException(`Unbalanced journal ${input.reference}: Dr ${debits} ≠ Cr ${credits}`);
    }
    if (lines.some((l) => (l.debit ?? dec(0)).isNeg() || (l.credit ?? dec(0)).isNeg())) {
      throw new InternalServerErrorException(`Negative ledger amount in ${input.reference}`);
    }
    return tx.journalEntry.create({
      data: {
        reference: input.reference,
        description: input.description,
        lines: {
          create: lines.map((l) => ({ account: l.account, debit: toMoneyString(l.debit ?? 0), credit: toMoneyString(l.credit ?? 0), loanId: input.loanId })),
        },
      },
    });
  }

  /** Customer-visible transaction line. */
  async record(tx: Tx, t: { userId: string; loanId?: string; type: TransactionType; direction: TxnDirection; amount: Decimal; description: string; referenceType?: string; referenceId?: string; journalId?: string }) {
    if (t.amount.isZero()) return null;
    return tx.transaction.create({
      data: {
        txnNo: this.crypto.reference('TXN'),
        userId: t.userId,
        loanId: t.loanId,
        type: t.type,
        direction: t.direction,
        amount: toMoneyString(t.amount),
        description: t.description,
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        journalId: t.journalId,
      },
    });
  }
}
