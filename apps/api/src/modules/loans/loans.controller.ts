import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, UserAuthGuard, type UserPrincipal } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { toRepaymentDto } from './loans.mapper';
import { LoansService } from './loans.service';

@ApiTags('Loans')
@ApiBearerAuth()
@UseGuards(UserAuthGuard)
@Controller()
export class LoansController {
  constructor(private readonly loans: LoansService, private readonly prisma: PrismaService) {}

  @Get('loans')
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'completed'] })
  list(@CurrentUser() u: UserPrincipal, @Query('status') status?: 'active' | 'completed') {
    return this.loans.listForUser(u.userId, status);
  }

  @Get('loans/:id')
  detail(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.loans.detailForUser(u.userId, id);
  }

  @Get('repayments/:id')
  async repayment(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    const r = await this.prisma.loanRepayment.findFirst({ where: { id, userId: u.userId }, include: { loan: { select: { loanNo: true, outstandingPrincipal: true, status: true } } } });
    if (!r) throw new NotFoundException();
    return { ...toRepaymentDto(r), loanNo: r.loan.loanNo, loanStatus: r.loan.status, outstandingPrincipal: r.loan.outstandingPrincipal.toFixed(2), allocation: r.allocation, interestWaived: r.interestWaived.toFixed(2) };
  }
}
