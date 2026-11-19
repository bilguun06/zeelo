import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ContractService } from './contract.service';

@Module({
  imports: [ProductsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ContractService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
