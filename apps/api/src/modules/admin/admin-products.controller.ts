import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Put, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { FeeCollection, LoanCategory, ProductStatus, RepaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { calculateQuote, dec } from '@orgil/financial-engine';
import { AuditService } from '../../common/audit.service';
import { AdminAuthGuard, CurrentAdmin, RequirePermissions, type AdminPrincipal } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { toProductDto } from '../products/products.mapper';

const MONEY = /^\d{1,13}(\.\d{1,2})?$/;
const RATE = /^\d{1,2}(\.\d{1,4})?$/;

class EligibilityDto {
  @ApiPropertyOptional() @IsOptional() @Matches(MONEY) minMonthlyIncome?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(18) @Max(100) minAgeYears?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(600) minEmploymentMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresKyc?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) notesMn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) notesEn?: string;
}

class ProductDto {
  @ApiProperty() @Matches(/^[A-Z0-9_]{3,32}$/) code: string;
  @ApiProperty({ enum: LoanCategory }) @IsEnum(LoanCategory) category: LoanCategory;
  @ApiProperty() @IsString() @Length(2, 80) nameMn: string;
  @ApiProperty() @IsString() @Length(2, 80) nameEn: string;
  @ApiProperty() @IsString() @MaxLength(500) descriptionMn: string;
  @ApiProperty() @IsString() @MaxLength(500) descriptionEn: string;
  @ApiProperty() @Matches(MONEY) minAmount: string;
  @ApiProperty() @Matches(MONEY) maxAmount: string;
  @ApiProperty() @Matches(MONEY) amountStep: string;
  @ApiProperty({ type: [Number] }) @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) @Min(1, { each: true }) @Max(120, { each: true }) allowedTerms: number[];
  @ApiProperty({ description: 'Monthly nominal rate, percent' }) @Matches(RATE) monthlyInterestRate: string;
  @ApiProperty() @Matches(RATE) serviceFeePercent: string;
  @ApiProperty() @Matches(MONEY) serviceFeeFixed: string;
  @ApiProperty({ enum: FeeCollection }) @IsEnum(FeeCollection) feeCollection: FeeCollection;
  @ApiProperty({ enum: RepaymentMethod }) @IsEnum(RepaymentMethod) repaymentMethod: RepaymentMethod;
  @ApiProperty({ description: 'Daily penalty rate on overdue amounts, percent' }) @Matches(RATE) penaltyRateDaily: string;
  @ApiProperty({ type: EligibilityDto }) @ValidateNested() @Type(() => EligibilityDto) eligibility: EligibilityDto;
  @ApiProperty({ enum: ProductStatus }) @IsEnum(ProductStatus) status: ProductStatus;
  @ApiProperty({ description: 'Provider/legal authorization. Customers only see ACTIVE + authorized products.' }) @IsBoolean() isAuthorized: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

@ApiTags('Admin · Products')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private validate(dto: ProductDto) {
    if (dec(dto.minAmount).gt(dec(dto.maxAmount))) throw new UnprocessableEntityException({ message: 'minAmount must be ≤ maxAmount', code: 'PRODUCT_INVALID' });
    if (dec(dto.amountStep).lte(0)) throw new UnprocessableEntityException({ message: 'amountStep must be positive', code: 'PRODUCT_INVALID' });
    if (dto.repaymentMethod === 'BULLET' && dto.allowedTerms.some((t) => t > 12)) throw new UnprocessableEntityException({ message: 'Bullet repayment supports terms up to 12 months', code: 'PRODUCT_INVALID' });
    // Dry-run the engine with the extremes so a misconfigured product can never be published.
    for (const term of [Math.min(...dto.allowedTerms), Math.max(...dto.allowedTerms)]) {
      calculateQuote({ ...dto, principal: dto.maxAmount, termMonths: term });
      const q = calculateQuote({ ...dto, principal: dto.minAmount, termMonths: term });
      if (dto.feeCollection === 'DEDUCTED_FROM_DISBURSEMENT' && dec(q.netDisbursement).lte(0)) {
        throw new UnprocessableEntityException({ message: 'Fees exceed the minimum loan amount', code: 'PRODUCT_INVALID' });
      }
    }
  }

  private data(dto: ProductDto) {
    return { ...dto, allowedTerms: [...new Set(dto.allowedTerms)].sort((a, b) => a - b), eligibility: { ...dto.eligibility } };
  }

  @Get()
  @RequirePermissions('products.read')
  async list() {
    const rows = await this.prisma.loanProduct.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: { _count: { select: { loans: true, applications: true } } } });
    return rows.map((p) => ({ ...toProductDto(p), sortOrder: p.sortOrder, loans: p._count.loans, applications: p._count.applications, updatedAt: p.updatedAt.toISOString() }));
  }

  @Get(':id')
  @RequirePermissions('products.read')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const p = await this.prisma.loanProduct.findUnique({ where: { id } });
    if (!p) throw new NotFoundException();
    return toProductDto(p);
  }

  @Post()
  @RequirePermissions('products.write')
  async create(@Body() dto: ProductDto, @CurrentAdmin() a: AdminPrincipal) {
    this.validate(dto);
    const p = await this.prisma.loanProduct.create({ data: this.data(dto) });
    await this.audit.log({ actorType: 'ADMIN', actorId: a.adminId, action: 'product.created', entityType: 'LoanProduct', entityId: p.id, after: toProductDto(p) });
    return toProductDto(p);
  }

  /** Pricing changes apply to NEW applications only — submitted applications keep their termsSnapshot. */
  @Put(':id')
  @RequirePermissions('products.write')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ProductDto, @CurrentAdmin() a: AdminPrincipal) {
    this.validate(dto);
    const before = await this.prisma.loanProduct.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    const p = await this.prisma.loanProduct.update({ where: { id }, data: this.data(dto) });
    await this.audit.log({ actorType: 'ADMIN', actorId: a.adminId, action: 'product.updated', entityType: 'LoanProduct', entityId: id, before: toProductDto(before), after: toProductDto(p) });
    return toProductDto(p);
  }
}
