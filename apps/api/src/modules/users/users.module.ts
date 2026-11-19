import { Module } from '@nestjs/common';
import { LoansModule } from '../loans/loans.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [LoansModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
