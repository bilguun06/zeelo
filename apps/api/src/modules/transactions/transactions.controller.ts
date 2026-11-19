import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma, TransactionType } from '@prisma/client';
import type { TransactionDto } from '@orgil/shared';
import { CurrentUser, UserAuthGuard, type UserPrincipal } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { m, paginate } from '../../common/serialize';

export function toTransactionDto(t: Prisma.TransactionGetPayload<{ include: { loan: { select: { loanNo: true } } } }>): TransactionDto {
  return {
    id: t.id, txnNo: t.txnNo, type: t.type, direction: t.direction, amount: m(t.amount), description: t.description,
    loanNo: t.loan?.loanNo ?? null, createdAt: t.createdAt.toISOString(),
  };
}

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(UserAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiQuery({ name: 'type', required: false, enum: TransactionType })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  async list(@CurrentUser() u: UserPrincipal, @Query() q: { type?: string; from?: string; to?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = paginate(q);
    const createdAt: Prisma.DateTimeFilter = {};
    if (q.from && !Number.isNaN(Date.parse(q.from))) createdAt.gte = new Date(q.from);
    if (q.to && !Number.isNaN(Date.parse(q.to))) createdAt.lte = new Date(q.to);
    const where: Prisma.TransactionWhereInput = {
      userId: u.userId,
      ...(q.type && q.type in TransactionType ? { type: q.type as TransactionType } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({ where, include: { loan: { select: { loanNo: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items: rows.map(toTransactionDto), total, page, pageSize };
  }
}
