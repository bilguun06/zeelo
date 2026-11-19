import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { LoansModule } from '../loans/loans.module';
import { PaymentsModule } from '../payments/payments.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [LoansModule, PaymentsModule, AdminModule],
  providers: [JobsService],
})
export class JobsModule {}
