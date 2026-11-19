import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { RepaymentsService } from './repayments.service';

@Module({
  controllers: [LoansController],
  providers: [LoansService, RepaymentsService],
  exports: [LoansService, RepaymentsService],
})
export class LoansModule {}
