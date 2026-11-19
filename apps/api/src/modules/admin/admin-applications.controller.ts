import {
  BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Query, UnprocessableEntityException, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { formatMNT } from '@orgil/shared';
import { AuditService } from '../../common/audit.service';
import { AdminAuthGuard, CurrentAdmin, RequirePermissions, type AdminPrincipal } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { iso, m, paginate } from '../../common/serialize';
import { CreditService } from '../credit/credit.service';
import { LoansService } from '../loans/loans.service';
import { NotificationsService } from '../notifications/notifications.service';

class DecisionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT', 'REQUEST_INFO'] }) @IsIn(['APPROVE', 'REJECT', 'REQUEST_INFO']) action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
  @ApiProperty({ description: 'Mandatory justification (shown to customer for REJECT / REQUEST_INFO)' }) @IsString() @Length(3, 1000) reason: string;
}
class NoteDto {
  @ApiProperty() @IsString() @Length(1, 2000) body: string;
}
class DisburseDto {
  @ApiProperty({ description: 'Bank transfer reference of the payout already executed' }) @IsString() @Length(4, 60) payoutReference: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

@ApiTags('Admin · Applications')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/applications')
export class AdminApplicationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credit: CreditService,
    private readonly loans: LoansService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('applications.read')
  async list(@Query() q: { status?: string; search?: string; productId?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = paginate(q);
    const statuses = (q.status ?? '').split(',').filter((s) => s in ApplicationStatus) as ApplicationStatus[];
    const s = q.search?.trim();
    const where: Prisma.LoanApplicationWhereInput = {
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(q.productId ? { productId: q.productId } : {}),
      ...(s ? { OR: [{ applicationNo: { contains: s, mode: 'insensitive' } }, { user: { phone: { contains: s } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.loanApplication.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { product: true, user: { include: { profile: true } }, creditScores: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.loanApplication.count({ where }),
    ]);
    return {
      items: rows.map((a) => ({
        id: a.id, applicationNo: a.applicationNo, status: a.status, amount: m(a.amount), termMonths: a.termMonths, product: a.product.nameMn,
        applicant: [a.user.profile?.lastName, a.user.profile?.firstName].filter(Boolean).join(' ') || a.user.phone, phone: a.user.phone,
        score: a.creditScores[0]?.score ?? null, riskGrade: a.creditScores[0]?.riskGrade ?? null, recommendation: a.creditScores[0]?.recommendation ?? null,
        submittedAt: iso(a.submittedAt), createdAt: a.createdAt.toISOString(),
      })),
      total, page, pageSize,
    };
  }

  @Get(':id')
  @RequirePermissions('applications.read')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const a = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: {
        product: true, bankAccount: true, contract: true, loan: { select: { id: true, loanNo: true } },
        user: { include: { profile: true, documents: { orderBy: { createdAt: 'desc' } } } },
        history: { orderBy: { createdAt: 'asc' } },
        notes: { include: { admin: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        approvals: { include: { admin: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        creditScores: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!a) throw new NotFoundException();
    return {
      id: a.id, applicationNo: a.applicationNo, status: a.status, amount: m(a.amount), termMonths: a.termMonths, purpose: a.purpose,
      submittedAt: iso(a.submittedAt), decidedAt: iso(a.decidedAt), decisionReason: a.decisionReason, infoRequest: a.infoRequest,
      product: { id: a.product.id, nameMn: a.product.nameMn, code: a.product.code },
      applicant: { userId: a.userId, phone: a.user.phone, kycStatus: a.user.profile?.kycStatus ?? 'NOT_STARTED', snapshot: a.applicantSnapshot },
      documents: a.user.documents.map((d) => ({ id: d.id, type: d.type, status: d.status, mimeType: d.mimeType, createdAt: d.createdAt.toISOString() })),
      bankAccount: a.bankAccount && { bankName: a.bankAccount.bankName, accountNumberMasked: `•••• ${a.bankAccount.accountLast4}`, accountHolder: a.bankAccount.accountHolder },
      terms: a.termsSnapshot,
      quote: a.quote,
      contract: a.contract && { templateVersion: a.contract.templateVersion, contentHash: a.contract.contentHash, acceptedAt: iso(a.contract.acceptedAt), acceptedIp: a.contract.acceptedIp, body: a.contract.body },
      assessments: a.creditScores.map((c) => this.credit.toDto(c)),
      history: a.history.map((h) => ({ from: h.fromStatus, to: h.toStatus, actorType: h.actorType, note: h.note, at: h.createdAt.toISOString() })),
      notes: a.notes.map((n) => ({ id: n.id, body: n.body, admin: n.admin.name, at: n.createdAt.toISOString() })),
      approvals: a.approvals.map((p) => ({ decision: p.decision, reason: p.reason, admin: p.admin.name, at: p.createdAt.toISOString() })),
      loan: a.loan,
    };
  }

  @Post(':id/decision')
  @HttpCode(200)
  @RequirePermissions('applications.decide')
  @ApiOperation({ summary: 'Human credit decision. AI recommendation is advisory only.' })
  async decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto, @CurrentAdmin() admin: AdminPrincipal) {
    const a = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: { creditScores: { orderBy: { createdAt: 'desc' }, take: 1 }, product: true, user: { include: { profile: true } } },
    });
    if (!a) throw new NotFoundException();
    if (!['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(a.status)) throw new UnprocessableEntityException({ message: `Cannot decide application in status ${a.status}`, code: 'INVALID_STATUS' });
    if (dto.action === 'APPROVE' && a.status === 'INFO_REQUESTED') throw new BadRequestException({ message: 'Waiting for customer information', code: 'INFO_PENDING' });
    // Compliance gate: identity must be verified before approving a product that requires KYC.
    if (dto.action === 'APPROVE' && (a.product.eligibility as { requiresKyc?: boolean })?.requiresKyc && a.user.profile?.kycStatus !== 'VERIFIED') {
      throw new UnprocessableEntityException({ message: 'Verify the customer’s identity documents before approving', code: 'KYC_NOT_VERIFIED' });
    }

    const to: ApplicationStatus = dto.action === 'APPROVE' ? 'APPROVED' : dto.action === 'REJECT' ? 'REJECTED' : 'INFO_REQUESTED';
    const score = a.creditScores[0];
    await this.prisma.$transaction(async (tx) => {
      await tx.loanApplication.update({
        where: { id },
        data: {
          status: to,
          decidedAt: dto.action === 'REQUEST_INFO' ? null : new Date(),
          decisionReason: dto.action === 'REQUEST_INFO' ? a.decisionReason : dto.reason,
          infoRequest: dto.action === 'REQUEST_INFO' ? dto.reason : a.infoRequest,
          assignedAdminId: admin.adminId,
        },
      });
      await tx.loanApproval.create({
        data: {
          applicationId: id, adminId: admin.adminId, decision: dto.action === 'APPROVE' ? 'APPROVED' : dto.action === 'REJECT' ? 'REJECTED' : 'INFO_REQUESTED',
          approvedAmount: dto.action === 'APPROVE' ? a.amount : null, approvedTermMonths: dto.action === 'APPROVE' ? a.termMonths : null,
          reason: dto.reason, creditScoreId: score?.id,
        },
      });
      await tx.applicationHistory.create({ data: { applicationId: id, fromStatus: a.status, toStatus: to, actorType: 'ADMIN', actorId: admin.adminId, note: dto.reason } });
      await this.audit.log({
        actorType: 'ADMIN', actorId: admin.adminId, action: `application.${dto.action.toLowerCase()}`, entityType: 'LoanApplication', entityId: id,
        before: { status: a.status }, after: { status: to, reason: dto.reason, aiRecommendation: score?.recommendation ?? null, aiScore: score?.score ?? null, overridesAi: score ? (dto.action === 'APPROVE') !== (score.recommendation === 'APPROVE_RECOMMENDED') : null },
      }, tx);
      const vars = { applicationNo: a.applicationNo, amount: formatMNT(a.amount.toFixed(2)), reason: dto.reason, message: dto.reason };
      const code = dto.action === 'APPROVE' ? 'LOAN_APPROVED' : dto.action === 'REJECT' ? 'LOAN_REJECTED' : 'INFO_REQUESTED';
      await this.notifications.notify(a.userId, code, vars, { applicationId: id }, tx);
    });
    return this.detail(id);
  }

  @Post(':id/notes')
  @RequirePermissions('applications.read')
  async note(@Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto, @CurrentAdmin() admin: AdminPrincipal) {
    await this.prisma.applicationNote.create({ data: { applicationId: id, adminId: admin.adminId, body: dto.body } });
    await this.audit.log({ actorType: 'ADMIN', actorId: admin.adminId, action: 'application.note_added', entityType: 'LoanApplication', entityId: id });
    return this.detail(id);
  }

  @Post(':id/rescore')
  @HttpCode(200)
  @RequirePermissions('applications.decide')
  async rescore(@Param('id', ParseUUIDPipe) id: string) {
    const a = await this.prisma.loanApplication.findUniqueOrThrow({ where: { id }, include: { product: true } });
    await this.credit.assess(a);
    return this.detail(id);
  }

  @Post(':id/disburse')
  @HttpCode(200)
  @RequirePermissions('loans.disburse')
  @ApiOperation({ summary: 'Book the loan after the payout bank transfer has been executed (records the transfer reference)' })
  async disburse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DisburseDto, @CurrentAdmin() admin: AdminPrincipal) {
    const approval = await this.prisma.loanApproval.findFirst({ where: { applicationId: id, decision: 'APPROVED' }, orderBy: { createdAt: 'desc' } });
    // Segregation of duties: the approver cannot also disburse.
    if (approval?.adminId === admin.adminId) throw new UnprocessableEntityException({ message: 'The approving officer cannot disburse the same loan (four-eyes rule)', code: 'FOUR_EYES' });
    const loan = await this.loans.disburse(id, admin.adminId, dto.payoutReference);
    return { loanId: loan.id, loanNo: loan.loanNo };
  }
}
