import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { DeployModule } from '../deploy/deploy.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DeployModule, EmailModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
