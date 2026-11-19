import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma, UserStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { AuditService } from '../../common/audit.service';
import { AdminAuthGuard, CurrentAdmin, RequirePermissions, type AdminPrincipal } from '../../common/auth';
import { CacheService } from '../../common/cache.service';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { iso, m, paginate } from '../../common/serialize';
import { StorageService } from '../kyc/storage.service';
import { toLoanDto } from '../loans/loans.mapper';

class UserStatusDto {
  @ApiProperty({ enum: UserStatus }) @IsEnum(UserStatus) status: UserStatus;
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}
class KycDecisionDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'] }) @IsIn(['VERIFIED', 'REJECTED']) decision: 'VERIFIED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

@ApiTags('Admin · Users')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  @RequirePermissions('users.read')
  async list(@Query() q: { search?: string; status?: string; kyc?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = paginate(q);
    const s = q.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(q.status && q.status in UserStatus ? { status: q.status as UserStatus } : {}),
      ...(q.kyc ? { profile: { kycStatus: q.kyc as never } } : {}),
      ...(s
        ? {
            OR: [
              { phone: { contains: s.replace(/\D/g, '') || s } },
              { profile: { firstName: { contains: s, mode: 'insensitive' } } },
              { profile: { lastName: { contains: s, mode: 'insensitive' } } },
              // Exact register-number search via blind index (encrypted field is never decrypted for search)
              ...(/^[А-ЯЁӨҮа-яёөү]{2}\d{8}$/u.test(s) ? [{ profile: { registerNumberHash: this.crypto.blindIndex(s) } }] : []),
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { profile: true, _count: { select: { loans: { where: { status: { in: ['ACTIVE', 'OVERDUE'] } } }, applications: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: rows.map((u) => ({
        id: u.id, phone: u.phone, status: u.status, createdAt: u.createdAt.toISOString(), lastLoginAt: iso(u.lastLoginAt),
        name: [u.profile?.lastName, u.profile?.firstName].filter(Boolean).join(' ') || null, kycStatus: u.profile?.kycStatus ?? 'NOT_STARTED',
        monthlyIncome: u.profile?.monthlyIncome ? m(u.profile.monthlyIncome) : null, activeLoans: u._count.loans, applications: u._count.applications,
      })),
      total, page, pageSize,
    };
  }

  @Get(':id')
  @RequirePermissions('users.read')
  async detail(@Param('id', ParseUUIDPipe) id: string, @CurrentAdmin() a: AdminPrincipal) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true, documents: { orderBy: { createdAt: 'desc' } }, bankAccounts: { where: { deletedAt: null } },
        loans: { include: { schedule: true, product: true }, orderBy: { disbursedAt: 'desc' } },
        applications: { include: { product: true }, orderBy: { createdAt: 'desc' } },
        sessions: { where: { revokedAt: null }, orderBy: { lastUsedAt: 'desc' }, take: 5 },
      },
    });
    if (!u) throw new NotFoundException();
    const p = u.profile;
    // Full register number is only revealed to staff who can review KYC; access is audited.
    const canSeePii = a.permissions.includes('kyc.review');
    if (canSeePii) await this.audit.log({ actorType: 'ADMIN', actorId: a.adminId, action: 'pii.viewed', entityType: 'User', entityId: u.id });
    return {
      id: u.id, phone: u.phone, status: u.status, language: u.language, createdAt: u.createdAt.toISOString(), lastLoginAt: iso(u.lastLoginAt),
      profile: p && {
        firstName: p.firstName, lastName: p.lastName, email: p.email, address: p.address, dateOfBirth: iso(p.dateOfBirth),
        registerNumber: canSeePii && p.registerNumberEnc ? this.crypto.decrypt(p.registerNumberEnc) : p.registerNumberLast4 ? `••••••${p.registerNumberLast4}` : null,
        employerName: p.employerName, employmentType: p.employmentType, jobTitle: p.jobTitle, monthlyIncome: p.monthlyIncome ? m(p.monthlyIncome) : null,
        monthlyObligations: p.monthlyObligations ? m(p.monthlyObligations) : null, employmentStartDate: iso(p.employmentStartDate), kycStatus: p.kycStatus, kycVerifiedAt: iso(p.kycVerifiedAt),
      },
      documents: u.documents.map((d) => ({ id: d.id, type: d.type, status: d.status, mimeType: d.mimeType, sizeBytes: d.sizeBytes, reviewNote: d.reviewNote, createdAt: d.createdAt.toISOString() })),
      bankAccounts: u.bankAccounts.map((b) => ({ id: b.id, bankName: b.bankName, accountNumberMasked: `•••• ${b.accountLast4}`, accountHolder: b.accountHolder, isPrimary: b.isPrimary })),
      loans: u.loans.map((l) => toLoanDto(l)),
      applications: u.applications.map((x) => ({ id: x.id, applicationNo: x.applicationNo, status: x.status, amount: m(x.amount), termMonths: x.termMonths, product: x.product.nameMn, createdAt: x.createdAt.toISOString() })),
      sessions: u.sessions.map((s) => ({ id: s.id, deviceName: s.deviceName, ip: s.ip, lastUsedAt: s.lastUsedAt.toISOString() })),
    };
  }

  @Patch(':id/status')
  @RequirePermissions('users.write')
  async setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UserStatusDto, @CurrentAdmin() a: AdminPrincipal) {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id }, select: { status: true } });
    await this.prisma.user.update({ where: { id }, data: { status: dto.status } });
    if (dto.status !== 'ACTIVE') {
      const sessions = await this.prisma.userSession.findMany({ where: { userId: id, revokedAt: null } });
      await this.prisma.userSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await Promise.all(sessions.map((s) => this.cache.del(`sess:ok:${s.id}`)));
    }
    await this.audit.log({ actorType: 'ADMIN', actorId: a.adminId, action: 'user.status_changed', entityType: 'User', entityId: id, before, after: { status: dto.status, reason: dto.reason } });
    return { ok: true };
  }

  @Post(':id/kyc')
  @RequirePermissions('kyc.review')
  async kyc(@Param('id', ParseUUIDPipe) id: string, @Body() dto: KycDecisionDto, @CurrentAdmin() a: AdminPrincipal) {
    const profile = await this.prisma.userProfile.findUniqueOrThrow({ where: { userId: id } });
    await this.prisma.$transaction([
      this.prisma.userProfile.update({
        where: { userId: id },
        data: { kycStatus: dto.decision, kycVerifiedAt: dto.decision === 'VERIFIED' ? new Date() : null, kycReviewedBy: a.adminId },
      }),
      this.prisma.userDocument.updateMany({ where: { userId: id, status: 'UPLOADED' }, data: { status: dto.decision === 'VERIFIED' ? 'ACCEPTED' : 'REJECTED', reviewedBy: a.adminId, reviewNote: dto.note } }),
    ]);
    await this.audit.log({ actorType: 'ADMIN', actorId: a.adminId, action: 'kyc.reviewed', entityType: 'UserProfile', entityId: profile.id, before: { kycStatus: profile.kycStatus }, after: { kycStatus: dto.decision, note: dto.note } });
    return { ok: true };
  }

  @Get(':id/documents/:docId')
  @RequirePermissions('kyc.review')
  async document(@Param('id', ParseUUIDPipe) id: string, @Param('docId', ParseUUIDPipe) docId: string, @CurrentAdmin() a: AdminPrincipal, @Res() res: Response) {
    const doc = await this.prisma.userDocument.findFirst({ where: { id: docId, userId: id } });
    if (!doc) throw new NotFoundException();
    const buf = await this.storage.get(doc.storageKey);
    await this.audit.log({ actorType: 'ADMIN', actorId: a.adminId, action: 'kyc.document_viewed', entityType: 'UserDocument', entityId: doc.id });
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'inline');
    res.send(buf);
  }
}
