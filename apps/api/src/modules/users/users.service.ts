import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { BankAccount, User, UserProfile } from '@prisma/client';
import { dec, maxDec, minDec, sum, toMoneyString } from '@orgil/financial-engine';
import { MONGOLIAN_BANKS, type BankAccountDto, type DashboardDto, type MeDto, type NotificationPrefs } from '@orgil/shared';
import { AuditService } from '../../common/audit.service';
import { CacheService } from '../../common/cache.service';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { iso, m } from '../../common/serialize';
import { SettingsService } from '../../common/settings.service';
import { toLoanDto } from '../loans/loans.mapper';
import { LoansService } from '../loans/loans.service';
import { toTransactionDto } from '../transactions/transactions.controller';
import { toApplicationDto } from '../applications/applications.mapper';
import type { CreateBankAccountDto, UpdateEmploymentDto, UpdatePersonalDto, UpdateSettingsDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly loans: LoansService,
  ) {}

  /**
   * INDICATIVE limit only: disposable income × configured multiple, capped. It is not an offer —
   * the binding decision is made by a credit officer per application.
   */
  async creditLimit(profile: UserProfile | null, userId: string) {
    const used = await this.loans.usedLimit(userId);
    const cap = dec(await this.settings.get<string>('credit.limit_cap'));
    let limit: ReturnType<typeof dec>;
    if (profile?.monthlyIncome && dec(profile.monthlyIncome.toString()).gt(0)) {
      const maxDti = dec(await this.settings.get<string>('credit.max_dti'));
      const multiple = dec(await this.settings.get<string>('credit.limit_income_multiple'));
      const disposable = dec(profile.monthlyIncome.toString()).mul(maxDti).minus(dec(profile.monthlyObligations?.toString() ?? 0));
      limit = minDec(cap, maxDec(disposable.mul(multiple), dec(0)));
      limit = limit.div(10_000).floor().mul(10_000); // round down to 10,000₮
    } else {
      limit = minDec(cap, dec(await this.settings.get<string>('credit.default_indicative_limit')));
    }
    return { limit: toMoneyString(limit), used: toMoneyString(used), available: toMoneyString(maxDec(limit.minus(used), dec(0))), isIndicative: true };
  }

  async me(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } });
    return this.toMe(user, user.profile);
  }

  private async toMe(user: User, p: UserProfile | null): Promise<MeDto> {
    return {
      id: user.id,
      phone: user.phone,
      language: user.language === 'en' ? 'en' : 'mn',
      biometricEnabled: user.biometricEnabled,
      createdAt: user.createdAt.toISOString(),
      notificationPrefs: user.notificationPrefs as unknown as NotificationPrefs,
      creditLimit: await this.creditLimit(p, user.id),
      profile: {
        firstName: p?.firstName ?? null,
        lastName: p?.lastName ?? null,
        registerNumberMasked: p?.registerNumberLast4 ? `••••••${p.registerNumberLast4}` : null,
        dateOfBirth: iso(p?.dateOfBirth),
        email: p?.email ?? null,
        address: p?.address ?? null,
        employerName: p?.employerName ?? null,
        employmentType: p?.employmentType ?? null,
        jobTitle: p?.jobTitle ?? null,
        monthlyIncome: p?.monthlyIncome ? m(p.monthlyIncome) : null,
        monthlyObligations: p?.monthlyObligations ? m(p.monthlyObligations) : null,
        employmentStartDate: iso(p?.employmentStartDate),
        kycStatus: p?.kycStatus ?? 'NOT_STARTED',
      },
    };
  }

  async updatePersonal(userId: string, dto: UpdatePersonalDto) {
    const profile = await this.prisma.userProfile.findUniqueOrThrow({ where: { userId } });
    const hash = this.crypto.blindIndex(dto.registerNumber);
    if (profile.kycStatus === 'VERIFIED' && (profile.registerNumberHash !== hash || profile.firstName !== dto.firstName || profile.lastName !== dto.lastName)) {
      throw new UnprocessableEntityException({ message: 'Verified identity fields cannot be changed. Contact support.', code: 'KYC_LOCKED' });
    }
    const owner = await this.prisma.userProfile.findUnique({ where: { registerNumberHash: hash } });
    if (owner && owner.userId !== userId) throw new ConflictException({ message: 'This register number is linked to another account', code: 'REGISTER_TAKEN' });
    const dob = new Date(dto.dateOfBirth);
    if (dob > new Date() || dob.getFullYear() < 1900) throw new UnprocessableEntityException({ message: 'Invalid date of birth', code: 'DOB_INVALID' });
    await this.prisma.userProfile.update({
      where: { userId },
      data: {
        firstName: dto.firstName, lastName: dto.lastName, registerNumberEnc: this.crypto.encrypt(dto.registerNumber),
        registerNumberHash: hash, registerNumberLast4: dto.registerNumber.slice(-4), dateOfBirth: dob, email: dto.email || null, address: dto.address,
      },
    });
    await this.audit.log({ actorType: 'USER', actorId: userId, action: 'profile.personal_updated', entityType: 'UserProfile', entityId: profile.id });
    return this.me(userId);
  }

  async updateEmployment(userId: string, dto: UpdateEmploymentDto) {
    const start = new Date(dto.employmentStartDate);
    if (start > new Date()) throw new UnprocessableEntityException({ message: 'Employment start cannot be in the future', code: 'DATE_INVALID' });
    await this.prisma.userProfile.update({
      where: { userId },
      data: {
        employerName: dto.employerName, employmentType: dto.employmentType, jobTitle: dto.jobTitle || null,
        monthlyIncome: dto.monthlyIncome, monthlyObligations: dto.monthlyObligations, employmentStartDate: start,
      },
    });
    await this.audit.log({ actorType: 'USER', actorId: userId, action: 'profile.employment_updated', entityType: 'UserProfile', entityId: userId });
    return this.me(userId);
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { language: dto.language, biometricEnabled: dto.biometricEnabled, notificationPrefs: dto.notificationPrefs ? { ...dto.notificationPrefs } : undefined },
    });
    return this.me(userId);
  }

  toBankDto(b: BankAccount): BankAccountDto {
    return { id: b.id, bankCode: b.bankCode, bankName: b.bankName, accountNumberMasked: `•••• ${b.accountLast4}`, accountHolder: b.accountHolder, isPrimary: b.isPrimary };
  }

  async bankAccounts(userId: string) {
    const rows = await this.prisma.bankAccount.findMany({ where: { userId, deletedAt: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] });
    return rows.map((b) => this.toBankDto(b));
  }

  async addBankAccount(userId: string, dto: CreateBankAccountDto) {
    const bank = MONGOLIAN_BANKS.find((b) => b.code === dto.bankCode);
    if (!bank) throw new UnprocessableEntityException({ message: 'Unknown bank', code: 'BANK_UNKNOWN' });
    const hash = this.crypto.blindIndex(dto.accountNumber);
    const existing = await this.prisma.bankAccount.findUnique({ where: { userId_accountNumberHash: { userId, accountNumberHash: hash } } });
    if (existing && !existing.deletedAt) throw new ConflictException({ message: 'Account already added', code: 'ACCOUNT_EXISTS' });
    const hasPrimary = await this.prisma.bankAccount.count({ where: { userId, deletedAt: null, isPrimary: true } });
    const data = {
      bankCode: bank.code, bankName: bank.nameMn, accountNumberEnc: this.crypto.encrypt(dto.accountNumber), accountNumberHash: hash,
      accountLast4: dto.accountNumber.slice(-4), accountHolder: dto.accountHolder, isPrimary: hasPrimary === 0, deletedAt: null,
    };
    // Integration point: verify account holder name with the bank before first payout.
    const row = existing
      ? await this.prisma.bankAccount.update({ where: { id: existing.id }, data })
      : await this.prisma.bankAccount.create({ data: { userId, ...data } });
    await this.audit.log({ actorType: 'USER', actorId: userId, action: 'bank_account.added', entityType: 'BankAccount', entityId: row.id, after: { bank: bank.code, last4: row.accountLast4 } });
    return this.toBankDto(row);
  }

  async setPrimaryBankAccount(userId: string, id: string) {
    const acc = await this.prisma.bankAccount.findFirst({ where: { id, userId, deletedAt: null } });
    if (!acc) throw new NotFoundException();
    await this.prisma.$transaction([
      this.prisma.bankAccount.updateMany({ where: { userId }, data: { isPrimary: false } }),
      this.prisma.bankAccount.update({ where: { id }, data: { isPrimary: true } }),
    ]);
    return this.bankAccounts(userId);
  }

  async removeBankAccount(userId: string, id: string) {
    const acc = await this.prisma.bankAccount.findFirst({ where: { id, userId, deletedAt: null } });
    if (!acc) throw new NotFoundException();
    const inUse = await this.prisma.loanApplication.count({ where: { bankAccountId: id, status: { in: ['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED'] } } });
    if (inUse) throw new UnprocessableEntityException({ message: 'Account is used by an open application', code: 'ACCOUNT_IN_USE' });
    await this.prisma.bankAccount.update({ where: { id }, data: { deletedAt: new Date(), isPrimary: false } });
  }

  async sessions(userId: string, currentSessionId: string) {
    const rows = await this.prisma.userSession.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: 'desc' } });
    return rows.map((s) => ({ id: s.id, deviceName: s.deviceName, ip: s.ip, lastUsedAt: s.lastUsedAt.toISOString(), createdAt: s.createdAt.toISOString(), current: s.id === currentSessionId }));
  }

  async revokeSession(userId: string, id: string) {
    await this.prisma.userSession.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.cache.del(`sess:ok:${id}`);
  }

  async dashboard(userId: string): Promise<DashboardDto> {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const [loans, txns, apps, unread, recentFlows] = await Promise.all([
      this.prisma.loan.findMany({ where: { userId, status: { in: ['ACTIVE', 'OVERDUE'] } }, include: { schedule: true, product: true }, orderBy: { disbursedAt: 'desc' } }),
      this.prisma.transaction.findMany({ where: { userId }, include: { loan: { select: { loanNo: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }),
      this.prisma.loanApplication.findMany({ where: { userId, status: { in: ['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED'] } }, include: { product: true, history: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      this.prisma.transaction.findMany({ where: { userId, createdAt: { gte: sixMonthsAgo }, type: { in: ['DISBURSEMENT', 'REPAYMENT'] } }, select: { type: true, amount: true, createdAt: true } }),
    ]);
    const loanDtos = loans.map((l) => toLoanDto(l));
    const next = loanDtos.filter((l) => l.nextDue).sort((a, b) => a.nextDue!.date.localeCompare(b.nextDue!.date))[0];

    const overview: DashboardDto['overview'] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo);
      d.setMonth(d.getMonth() + i);
      const inMonth = recentFlows.filter((t) => t.createdAt.getFullYear() === d.getFullYear() && t.createdAt.getMonth() === d.getMonth());
      overview.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        borrowed: toMoneyString(sum(inMonth.filter((t) => t.type === 'DISBURSEMENT').map((t) => t.amount.toString()))),
        repaid: toMoneyString(sum(inMonth.filter((t) => t.type === 'REPAYMENT').map((t) => t.amount.toString()))),
      });
    }

    return {
      creditLimit: await this.creditLimit(profile, userId),
      activeLoans: loanDtos,
      nextRepayment: next?.nextDue ? { loanId: next.id, loanNo: next.loanNo, date: next.nextDue.date, amount: next.nextDue.amount } : null,
      totalOutstanding: toMoneyString(sum(loanDtos.map((l) => l.totalOutstanding))),
      recentTransactions: txns.map(toTransactionDto),
      openApplications: apps.map(toApplicationDto),
      unreadNotifications: unread,
      overview,
    };
  }
}
