import { Global, Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { TenantDbService } from '../../common/database/tenant-db.service';

@Global()
@Module({
  controllers: [MonitoringController],
  providers: [MonitoringService, TenantDbService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
