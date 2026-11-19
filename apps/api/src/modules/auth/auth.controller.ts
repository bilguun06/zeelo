import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, UserAuthGuard, type UserPrincipal } from '../../common/auth';
import { ChangePasswordDto, LoginDto, RefreshDto, RegisterDto, RequestOtpDto, ResetPasswordDto, VerifyOtpDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a 6-digit OTP via SMS (registration or password reset)' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone, dto.purpose);
  }

  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify OTP and receive a short-lived verification token' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.purpose, dto.code);
  }

  @Post('register')
  @ApiOperation({ summary: 'Create account with verified phone + password' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.verificationToken, dto.password, dto.deviceName);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.phone, dto.password, dto.deviceName);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token and get a new access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('password/reset')
  @HttpCode(204)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.verificationToken, dto.password);
  }

  @Post('password/change')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(UserAuthGuard)
  changePassword(@CurrentUser() u: UserPrincipal, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(u.userId, u.sessionId, dto.currentPassword, dto.newPassword);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(UserAuthGuard)
  logout(@CurrentUser() u: UserPrincipal) {
    return this.auth.logout(u.sessionId);
  }
}
