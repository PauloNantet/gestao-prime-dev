import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { Public } from '../../common/decorators/public.decorator';
import { LoginDto, RegisterDto, ActionType } from '@gestao-prime/shared';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private monitoring: MonitoringService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const result = await this.auth.register(dto);
    if (result.user.tenantId) {
      this.monitoring.log({
        tenantId: result.user.tenantId,
        userId: result.user.id,
        action: ActionType.CREATE,
        entity: 'user',
        entityId: result.user.id,
        metadata: { email: result.user.email, name: result.user.name },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }
    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const result = await this.auth.login(dto);
    if (result.user.tenantId) {
      this.monitoring.log({
        tenantId: result.user.tenantId,
        userId: result.user.id,
        action: ActionType.LOGIN,
        entity: 'user',
        entityId: result.user.id,
        metadata: { email: result.user.email },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }
    return result;
  }
}
