import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenantsModule,
    PlansModule,
    SubscriptionsModule,
    MonitoringModule,
  ],
})
export class AppModule {}
