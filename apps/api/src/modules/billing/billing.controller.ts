import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService) {}

  @Post('checkout/:tenantId')
  checkout(@Param('tenantId') tenantId: string, @Body('paymentMethod') paymentMethod?: string) {
    return this.billing.checkout(tenantId, paymentMethod);
  }

  @Post('webhook/asaas')
  handleWebhook(@Body() body: any) {
    if (body.event === 'PAYMENT_RECEIVED' || body.event === 'PAYMENT_CONFIRMED') {
      return this.billing.handlePaymentConfirmation(body.payment.id);
    }
    return { received: true };
  }

  @Get('invoices/:tenantId')
  getInvoices(@Param('tenantId') tenantId: string) {
    return this.billing.getInvoices(tenantId);
  }

  @Get('revenue')
  getRevenue() {
    return this.billing.getRevenue();
  }
}
