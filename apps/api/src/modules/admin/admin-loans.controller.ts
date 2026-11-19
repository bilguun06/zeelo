import { Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LoanStatus, Prisma } from '@prisma/client';
import type { Response } from 'express';
import { AdminAuthGuard, CurrentAdmin, RequirePermissions, type AdminPrincipal } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { m, paginate } from '../../common/serialize';
import { toLoanDetail, toLoanDto } from '../loans/loans.mapper';
import { LoansService } from '../loans/loans.service';
import { PaymentsService } from '../payments/payments.service';
import { ReportsService, type Granularity, type ReportType } from '../reports/reports.service';

@ApiTags('Admin · Loans & Payments')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminLoansController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loans: LoansService,
    private readonly payments: PaymentsService,
    private readonly reports: ReportsService,
  ) {}

  @Get('overview')
  @RequirePermissions('reports.read')
  overview() {
    return this.reports.overview();
  }

  @Get('loans')
  @RequirePermissions('loans.read')
  @ApiQuery({ name: 'status', required: false, enum: LoanStatus })
  async list(@Query() q: { status?: string; search?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = paginate(q);
    const s = q.search?.trim();
    const where: Prisma.LoanWhereInput = {
      ...(q.status && q.status in LoanStatus ? { status: q.status as LoanStatus } : {}),
      ...(s ? { OR: [{ loanNo: { contains: s, mode: 'insensitive' } }, { user: { phone: { contains: s } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.loan.findMany({ where, skip, take, orderBy: { disbursedAt: 'desc' }, include: { schedule: true, product: true, user: { include: { profile: true } } } }),
      this.prisma.loan.count({ where }),
    ]);
    return {
      items: rows.map((l) => ({ ...toLoanDto(l), phone: l.user.phone, borrower: [l.user.profile?.lastName, l.user.profile?.firstName].filter(Boolean).join(' ') || l.user.phone })),
      total, page, pageSize,
    };
  }

  @Get('loans/:id')
  @RequirePermissions('loans.read')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const l = await this.prisma.loan.findUnique({ where: { id }, include: { schedule: true, product: true, repayments: true, user: { include: { profile: true } }, application: { select: { id: true, applicationNo: true } } } });
    if (!l) throw new NotFoundException();
    const ledger = await this.prisma.ledgerLine.findMany({ where: { loanId: id }, include: { journal: true }, orderBy: { createdAt: 'asc' } });
    return {
      ...toLoanDetail(l),
      borrower: { userId: l.userId, phone: l.user.phone, name: [l.user.profile?.lastName, l.user.profile?.firstName].filter(Boolean).join(' ') },
      application: l.application,
      serviceFee: m(l.serviceFee),
      penaltyRateDaily: l.penaltyRateDaily.toString(),
      ledger: ledger.map((x) => ({ id: x.id, reference: x.journal.reference, description: x.journal.description, account: x.account, debit: m(x.debit), credit: m(x.credit), at: x.createdAt.toISOString() })),
    };
  }

  @Post('loans/jobs/refresh-overdue')
  @HttpCode(200)
  @RequirePermissions('loans.disburse')
  @ApiOperation({ summary: 'Run the overdue/penalty job now (it also runs daily)' })
  refreshOverdue() {
    return this.loans.refreshOverdue();
  }

  @Get('payments/reconciliation')
  @RequirePermissions('loans.read')
  reconciliation() {
    return this.payments.reconciliation();
  }

  @Post('payments/:id/refund')
  @HttpCode(200)
  @RequirePermissions('loans.disburse')
  refund(@Param('id', ParseUUIDPipe) id: string, @CurrentAdmin() a: AdminPrincipal) {
    return this.payments.refund(id, a.adminId);
  }

  @Get('reports/:type')
  @RequirePermissions('reports.read')
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'xlsx', 'pdf'] })
  @ApiQuery({ name: 'granularity', required: false, enum: ['day', 'month', 'year'] })
  async report(
    @Param('type') type: ReportType,
    @Query() q: { from?: string; to?: string; granularity?: Granularity; format?: 'json' | 'xlsx' | 'pdf' },
    @CurrentAdmin() a: AdminPrincipal,
    @Res() res: Response,
  ) {
    if (!['summary', 'disbursements', 'repayments', 'overdue'].includes(type)) throw new NotFoundException();
    const report = await this.reports.build(type, q);
    if (!q.format || q.format === 'json') return res.json(report);
    if (!a.permissions.includes('reports.export')) return res.status(403).json({ statusCode: 403, message: 'Missing permission: reports.export' });
    const stamp = new Date().toISOString().slice(0, 10);
    if (q.format === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="orgil-${type}-${stamp}.xlsx"`);
      return res.send(await this.reports.toXlsx(report));
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="orgil-${type}-${stamp}.pdf"`);
    return res.send(await this.reports.toPdf(report));
  }
}
