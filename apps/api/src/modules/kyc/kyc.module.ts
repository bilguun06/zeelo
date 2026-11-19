import { Global, Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [KycController],
  providers: [StorageService],
  exports: [StorageService],
})
export class KycModule {}
