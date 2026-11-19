import { Global, Module } from '@nestjs/common';
import { SimulatedBureauProvider } from './bureau.provider';
import { CreditService } from './credit.service';

@Global()
@Module({
  providers: [CreditService, SimulatedBureauProvider],
  exports: [CreditService],
})
export class CreditModule {}
