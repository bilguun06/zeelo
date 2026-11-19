import { Global, Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { TransactionsController } from './transactions.controller';

@Global()
@Module({
  controllers: [TransactionsController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class TransactionsModule {}
