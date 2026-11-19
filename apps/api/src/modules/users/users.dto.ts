import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsEmail, IsEnum, IsIn, IsISO8601, IsOptional, IsString, Length, Matches, MaxLength, ValidateNested,
} from 'class-validator';
import { EmploymentType } from '@prisma/client';

const MONEY = /^\d{1,13}(\.\d{1,2})?$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdatePersonalDto {
  @ApiProperty() @Transform(trim) @Length(1, 60) lastName: string;
  @ApiProperty() @Transform(trim) @Length(1, 60) firstName: string;
  @ApiProperty({ example: 'УБ99112233' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[А-ЯЁӨҮ]{2}\d{8}$/u, { message: 'Register number must be 2 Cyrillic letters + 8 digits' })
  registerNumber: string;
  @ApiProperty({ example: '1995-04-12' }) @IsISO8601({ strict: true }) dateOfBirth: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsEmail() email?: string;
  @ApiProperty() @Transform(trim) @Length(3, 250) address: string;
}

export class UpdateEmploymentDto {
  @ApiProperty() @Transform(trim) @Length(1, 120) employerName: string;
  @ApiProperty({ enum: EmploymentType }) @IsEnum(EmploymentType) employmentType: EmploymentType;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @MaxLength(80) jobTitle?: string;
  @ApiProperty({ example: '3500000.00' }) @Matches(MONEY) monthlyIncome: string;
  @ApiProperty({ example: '0.00' }) @Matches(MONEY) monthlyObligations: string;
  @ApiProperty({ example: '2021-09-01' }) @IsISO8601({ strict: true }) employmentStartDate: string;
}

class NotificationPrefsDto {
  @IsBoolean() push: boolean;
  @IsBoolean() sms: boolean;
  @IsBoolean() email: boolean;
  @IsBoolean() repaymentReminders: boolean;
  @IsBoolean() marketing: boolean;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: ['mn', 'en'] }) @IsOptional() @IsIn(['mn', 'en']) language?: 'mn' | 'en';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() biometricEnabled?: boolean;
  @ApiPropertyOptional({ type: NotificationPrefsDto }) @IsOptional() @ValidateNested() @Type(() => NotificationPrefsDto) notificationPrefs?: NotificationPrefsDto;
}

export class CreateBankAccountDto {
  @ApiProperty({ example: 'KHAN' }) @IsString() @Length(2, 20) bankCode: string;
  @ApiProperty({ example: '5012345678' }) @Matches(/^\d{8,16}$/) accountNumber: string;
  @ApiProperty() @Transform(trim) @Length(2, 120) accountHolder: string;
}
