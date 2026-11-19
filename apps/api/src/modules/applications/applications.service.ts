import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { formatMNT, type Eligibility } from '@orgil/shared';
import { AuditService } from '../../common/audit.service';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { requestContext } from '../../common/request-context';
import { CreditService } from '../credit/credit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { pricingOf } from '../products/products.mapper';
import { ProductsService } from '../products/products.service';
import { toApplicationDto } from './applications.mapper';
import { ContractService } from './contract.service';

const OPEN_STATUSES = ['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED'] as const;
const include = { product: true, history: true, loan: { select: { id: true } } } satisfies Prisma.LoanApplicationInclude;

export interface ApplicationInput {
  productId: string;
  amount: string;
  termMonths: number;
  bankAccountId: string;
  purpose?: string;
}

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly contracts: ContractService,
    private readonly credit: CreditService,
    private readonly notifications: NotificationsService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  private async prepare(userId: string, input: ApplicationInput) {
    const product = await this.products.getPublic(input.productId);
    this.products.assertWithinLimits(product, input.amount, input.termMonths);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } });
    const p = user.profile;
    const missing: string[] = [];
    if (!p?.firstName || !p.lastName || !p.registerNumberEnc || !p.dateOfBirth || !p.address) missing.push('personal');
    if (!p?.employerName || !p.monthlyIncome || !p.employmentStartDate || !p.employmentType) missing.push('employment');
    const eligibility = (product.eligibility ?? {}) as Eligibility;
    if (eligibility.requiresKyc && !['PENDING', 'VERIFIED'].includes(p?.kycStatus ?? '')) missing.push('identity');
    if (missing.length) throw new UnprocessableEntityException({ message: `Incomplete profile: ${missing.join(', ')}`, code: 'PROFILE_INCOMPLETE', missing });

    const bank = await this.prisma.bankAccount.findFirst({ where: { id: input.bankAccountId, userId, deletedAt: null } });
    if (!bank) throw new BadRequestException({ message: 'Bank account not found', code: 'BANK_ACCOUNT' });

    const quote = this.products.quoteFor(pricingOf(product), input.amount, input.termMonths, false);
    const contract = await this.contracts.render({ profile: p!, phone: user.phone, product, quote, bankLabel: `${bank.bankName} •••• ${bank.accountLast4}` });
    return { product, user, profile: p!, bank, quote, contract };
  }

  /** Step 8 of the wizard: final terms + agreement text for review. */
  async preview(userId: string, input: ApplicationInput) {
    const { quote, contract } = await this.prepare(userId, input);
    return { quote: { ...quote, isDemonstration: false }, contract };
  }

  async submit(userId: string, input: ApplicationInput & { contractHash: string; acceptTerms: boolean; consentDataProcessing: boolean }) {
    if (!input.acceptTerms || !input.consentDataProcessing) throw new BadRequestException({ message: 'Agreement and data consent are required', code: 'CONSENT_REQUIRED' });
    const open = await this.prisma.loanApplication.count({ where: { userId, status: { in: [...OPEN_STATUSES] } } });
    if (open > 0) throw new ConflictException({ message: 'You already have an application in progress', code: 'APPLICATION_OPEN' });

    const { product, profile, bank, quote, contract } = await this.prepare(userId, input);
    if (!this.crypto.safeEqual(contract.contentHash, input.contractHash ?? '')) {
      throw new ConflictException({ message: 'Terms changed since you reviewed them. Please review again.', code: 'CONTRACT_CHANGED' });
    }
    const ctx = requestContext();

    const app = await this.prisma.$transaction(async (tx) => {
      const created = await tx.loanApplication.create({
        data: {
          applicationNo: this.crypto.reference('APP'),
          userId,
          productId: product.id,
          bankAccountId: bank.id,
          amount: quote.principal,
          termMonths: input.termMonths,
          purpose: input.purpose?.slice(0, 200),
          status: 'PENDING',
          submittedAt: new Date(),
          applicantSnapshot: {
            firstName: profile.firstName, lastName: profile.lastName, registerNumberLast4: profile.registerNumberLast4,
            employerName: profile.employerName, employmentType: profile.employmentType, monthlyIncome: profile.monthlyIncome?.toString(),
            monthlyObligations: profile.monthlyObligations?.toString(), employmentStartDate: profile.employmentStartDate?.toISOString(), kycStatus: profile.kycStatus,
          },
          termsSnapshot: { ...pricingOf(product), penaltyRateDaily: product.penaltyRateDaily.toString() },
          quote: quote as unknown as Prisma.InputJsonValue,
          history: { create: { toStatus: 'PENDING', actorType: 'USER', actorId: userId } },
        },
      });
      await tx.digitalContract.create({
        data: {
          applicationId: created.id, userId, templateVersion: contract.templateVersion, body: contract.body, contentHash: contract.contentHash,
          acceptedAt: new Date(), acceptedIp: ctx?.ip, acceptedUserAgent: ctx?.userAgent,
        },
      });
      await this.audit.log({ actorType: 'USER', actorId: userId, action: 'application.submitted', entityType: 'LoanApplication', entityId: created.id, after: { amount: quote.principal, term: input.termMonths, product: product.code, contractHash: contract.contentHash } }, tx);
      return created;
    });

    await this.runAssessment(app.id);
    await this.notifications.notify(userId, 'APPLICATION_RECEIVED', { applicationNo: app.applicationNo, amount: formatMNT(quote.principal) }, { applicationId: app.id });
    return this.getForUser(userId, app.id);
  }

  /** Scores the application and moves it to the human review queue. Never auto-approves. */
  async runAssessment(applicationId: string) {
    const app = await this.prisma.loanApplication.findUniqueOrThrow({ where: { id: applicationId }, include: { product: true } });
    try {
      await this.credit.assess(app);
    } catch (e) {
      this.logger.error(`Credit assessment failed for ${app.applicationNo}: ${(e as Error).message}`);
    }
    if (app.status === 'PENDING' || app.status === 'INFO_REQUESTED') {
      await this.prisma.loanApplication.update({
        where: { id: app.id },
        data: { status: 'UNDER_REVIEW', history: { create: { fromStatus: app.status, toStatus: 'UNDER_REVIEW', actorType: 'SYSTEM', note: 'Queued for credit officer review' } } },
      });
    }
  }

  async listForUser(userId: string) {
    const rows = await this.prisma.loanApplication.findMany({ where: { userId }, include, orderBy: { createdAt: 'desc' } });
    return rows.map(toApplicationDto);
  }

  async getForUser(userId: string, id: string) {
    const a = await this.prisma.loanApplication.findFirst({ where: { id, userId }, include });
    if (!a) throw new NotFoundException();
    return toApplicationDto(a);
  }

  async contractForUser(userId: string, id: string) {
    const c = await this.prisma.digitalContract.findFirst({ where: { applicationId: id, userId } });
    if (!c) throw new NotFoundException();
    return { templateVersion: c.templateVersion, body: c.body, contentHash: c.contentHash, acceptedAt: c.acceptedAt };
  }

  async cancel(userId: string, id: string) {
    const a = await this.prisma.loanApplication.findFirst({ where: { id, userId } });
    if (!a) throw new NotFoundException();
    if (!['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(a.status)) throw new UnprocessableEntityException({ message: 'Application can no longer be cancelled', code: 'INVALID_STATUS' });
    await this.prisma.loanApplication.update({
      where: { id },
      data: { status: 'CANCELLED', history: { create: { fromStatus: a.status, toStatus: 'CANCELLED', actorType: 'USER', actorId: userId } } },
    });
    await this.audit.log({ actorType: 'USER', actorId: userId, action: 'application.cancelled', entityType: 'LoanApplication', entityId: id });
    return this.getForUser(userId, id);
  }

  /** Customer replies to an information request; the application is re-scored and re-queued. */
  async respond(userId: string, id: string, message: string) {
    const a = await this.prisma.loanApplication.findFirst({ where: { id, userId } });
    if (!a) throw new NotFoundException();
    if (a.status !== 'INFO_REQUESTED') throw new UnprocessableEntityException({ message: 'No information was requested', code: 'INVALID_STATUS' });
    await this.prisma.applicationHistory.create({ data: { applicationId: id, fromStatus: 'INFO_REQUESTED', toStatus: 'INFO_REQUESTED', actorType: 'USER', actorId: userId, note: message.slice(0, 1000) } });
    await this.runAssessment(id);
    return this.getForUser(userId, id);
  }
}
