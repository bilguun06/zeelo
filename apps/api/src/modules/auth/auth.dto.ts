import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

const PHONE = /^[6-9]\d{7}$/;
const PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const normalizePhone = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\D/g, '').replace(/^976(?=\d{8}$)/, '') : value);

export class RequestOtpDto {
  @ApiProperty({ example: '99112233' }) @Transform(normalizePhone) @Matches(PHONE, { message: 'Invalid Mongolian mobile number' })
  phone: string;

  @ApiProperty({ enum: ['REGISTER', 'RESET_PASSWORD'] }) @IsIn(['REGISTER', 'RESET_PASSWORD'])
  purpose: 'REGISTER' | 'RESET_PASSWORD';
}

export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty({ example: '123456' }) @Matches(/^\d{6}$/)
  code: string;
}

export class RegisterDto {
  @ApiProperty() @IsString() @Length(20, 100)
  verificationToken: string;

  @ApiProperty({ example: 'Secret123' }) @Matches(PASSWORD, { message: 'Password must be 8–72 chars with letters and digits' })
  password: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  deviceName?: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() @Length(20, 100)
  verificationToken: string;

  @ApiProperty() @Matches(PASSWORD, { message: 'Password must be 8–72 chars with letters and digits' })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: '99112233' }) @Transform(normalizePhone) @Matches(PHONE)
  phone: string;

  @ApiProperty() @IsString() @Length(1, 72)
  password: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  deviceName?: string;
}

export class RefreshDto {
  @ApiProperty() @IsString() @Length(20, 200)
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @Length(1, 72)
  currentPassword: string;

  @ApiProperty() @Matches(PASSWORD)
  newPassword: string;
}
