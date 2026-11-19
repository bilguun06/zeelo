import { Injectable } from '@nestjs/common';
import type { CreditScore, LoanApplication, LoanProduct, Prisma } from '@prisma/client';
import type { CreditAssessmentDto, Eligibility, QuoteDto } from '@orgil/shared';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { SimulatedBureauProvider } from './bureau.provider';
import { scoreApplication } from './credit-scoring';

const monthsBetween = (from: Date, to = new Date()) => Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));

@Injectable()
export class CreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bureau: SimulatedBureauProvider,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Runs the scorecard for an application and stores the explainable result. */
  async assess(app: LoanApplication & { product: LoanProduct }): Promise<CreditScore> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: app.userId }, include: { profile: true } });
    const profile = user.profile;
    const quote = app.quote as unknown as QuoteDto;
    const eligibility = (app.product.eligibility ?? {}) as Eligibility;

    const [completedLoans, lateInstallments, overdueLoans, apps24h, myDocs] = await Promise.all([
      this.prisma.loan.count({ where: { userId: user.id, status: 'COMPLETED' } }),
      this.prisma.loanSchedule.count({ where: { loan: { userId: user.id }, OR: [{ status: 'OVERDUE' }, { penaltyDue: { gt: 0 } }] } }),
      this.prisma.loan.count({ where: { userId: user.id, status: 'OVERDUE' } }),
      this.prisma.loanApplication.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
      this.prisma.userDocument.findMany({ where: { userId: user.id }, select: { sha256: true } }),
    ]);
    const duplicates = myDocs.length
      ? await this.prisma.userDocument.count({ where: { sha256: { in: myDocs.map((d) => d.sha256) }, userId: { not: user.id } } })
      : 0;

    const result = scoreApplication({
      monthlyIncome: profile?.monthlyIncome?.toString() ?? null,
      monthlyObligations: profile?.monthlyObligations?.toString() ?? null,
      employmentMonths: profile?.employmentStartDate ? monthsBetween(profile.employmentStartDate) : null,
      employmentType: profile?.employmentType ?? null,
      kycVerified: profile?.kycStatus === 'VERIFIED',
      ageYears: profile?.dateOfBirth ? Math.floor(monthsBetween(profile.dateOfBirth) / 12) : null,
      requestedAmount: app.amount.toString(),
      newMonthlyPayment: quote.firstPayment,
      internal: { completedLoans, lateInstallments, currentlyOverdue: overdueLoans > 0 },
      bureau: await this.bureau.report(profile?.registerNumberHash ?? user.id),
      fraud: { applications24h: apps24h, accountAgeDays: (Date.now() - user.createdAt.getTime()) / 86_400_000, duplicateDocumentAcrossUsers: duplicates > 0 },
      policy: {
        maxDti: await this.settings.get<string>('credit.max_dti'),
        minAgeYears: Math.max(Number(await this.settings.get<number>('credit.min_age_years')), eligibility.minAgeYears ?? 0),
        minMonthlyIncome: eligibility.minMonthlyIncome,
        minEmploymentMonths: eligibility.minEmploymentMonths,
        requiresKyc: eligibility.requiresKyc,
      },
    });

    const saved = await this.prisma.creditScore.create({
      data: {
        userId: user.id,
        applicationId: app.id,
        score: result.score,
        riskGrade: result.riskGrade,
        probabilityOfDefault: result.probabilityOfDefault,
        debtToIncome: result.debtToIncome,
        recommendation: result.recommendation,
        factors: result.factors as unknown as Prisma.InputJsonValue,
        policyChecks: result.policyChecks as unknown as Prisma.InputJsonValue,
        fraudFlags: result.fraudFlags as unknown as Prisma.InputJsonValue,
        modelVersion: result.modelVersion,
        dataSource: 'SIMULATED',
      },
    });
    await this.audit.log({ actorType: 'SYSTEM', action: 'credit.assessed', entityType: 'LoanApplication', entityId: app.id, after: { score: result.score, grade: result.riskGrade, recommendation: result.recommendation, model: result.modelVersion } });
    return saved;
  }

  toDto(c: CreditScore): CreditAssessmentDto {
    return {
      id: c.id,
      score: c.score,
      riskGrade: c.riskGrade,
      probabilityOfDefault: c.probabilityOfDefault.toString(),
      recommendation: c.recommendation,
      debtToIncome: c.debtToIncome.toString(),
      factors: c.factors as unknown as CreditAssessmentDto['factors'],
      policyChecks: c.policyChecks as unknown as CreditAssessmentDto['policyChecks'],
      fraudFlags: c.fraudFlags as unknown as CreditAssessmentDto['fraudFlags'],
      modelVersion: c.modelVersion,
      dataSource: c.dataSource === 'BUREAU' ? 'BUREAU' : 'SIMULATED',
      requiresHumanDecision: true,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
