import { Global, Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { SubscriptionDbService } from '../../common/database/subscription-db.service';

@Global()
@Module({
  controllers: [MonitoringController],
  providers: [MonitoringService, TenantDbService, SubscriptionDbService],
  exports: [MonitoringService, TenantDbService, SubscriptionDbService],
})
export class MonitoringModule {}
