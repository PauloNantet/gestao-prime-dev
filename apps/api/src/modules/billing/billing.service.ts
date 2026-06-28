import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeployService } from '../deploy/deploy.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class BillingService {
  private readonly ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
  private readonly ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

  constructor(
    private prisma: PrismaService,
    private deploy: DeployService,
    private email: EmailService,
  ) {}

  async checkout(tenantId: string, paymentMethod: string = 'pix') {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: { include: { plan: { include: { products: { include: { product: true } } } } } } },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (!tenant.subscription) throw new BadRequestException('Sem assinatura ativa');

    const plan = tenant.subscription.plan;
    const amountInCents = plan.price;

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId: tenant.subscription.id,
        amount: amountInCents,
        status: 'pending',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    if (this.ASAAS_API_KEY) {
      try {
        const asaasData = await this.createAsaasCharge(tenant, amountInCents, paymentMethod);
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            asaasInvoiceId: asaasData.id,
            pixQrCode: asaasData.pixQrCode || null,
            pixCopiaCola: asaasData.pixCopiaCola || null,
            paymentMethod,
          },
        });
        return { ...invoice, pixQrCode: asaasData.pixQrCode, pixCopiaCola: asaasData.pixCopiaCola };
      } catch (err) {
        console.error('Asaas error:', err);
      }
    }

    return invoice;
  }

  async handlePaymentConfirmation(asaasInvoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { asaasInvoiceId } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'paid', paidAt: new Date() },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: invoice.tenantId },
      include: { subscription: { include: { plan: { include: { products: { include: { product: true } } } } } } },
    });
    if (!tenant) return;

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: 'active' },
    });

    await this.prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { status: 'active' },
    });

    for (const pp of tenant.subscription?.plan.products || []) {
      await this.deploy.deployProduct(tenant.id, tenant.slug, pp.product);
    }

    await this.email.sendWelcome(tenant.email, tenant.name, tenant.slug);
  }

  private async createAsaasCharge(tenant: any, amountInCents: number, paymentMethod: string) {
    const customerId = await this.getOrCreateAsaasCustomer(tenant);
    const amountInReais = (amountInCents / 100).toFixed(2);

    const body: any = {
      customer: customerId,
      value: parseFloat(amountInReais),
      description: `Assinatura ${tenant.subscription?.plan.name || 'Gestão Prime'}`,
    };

    if (paymentMethod === 'pix') {
      body.billingType = 'PIX';
    } else {
      body.billingType = 'CREDIT_CARD';
      body.creditCard = tenant.creditCard;
      body.creditCardHolderInfo = tenant.creditCardHolderInfo;
    }

    const res = await fetch(`${this.ASAAS_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'access_token': this.ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (paymentMethod === 'pix') {
      const pixRes = await fetch(`${this.ASAAS_API_URL}/payments/${data.id}/pixQrCode`, {
        headers: { 'access_token': this.ASAAS_API_KEY },
      });
      const pixData = await pixRes.json();
      return { id: data.id, pixQrCode: pixData.encodedImage, pixCopiaCola: pixData.payload };
    }

    return { id: data.id };
  }

  private async getOrCreateAsaasCustomer(tenant: any): Promise<string> {
    if (tenant.asaasCustomerId) return tenant.asaasCustomerId;

    const res = await fetch(`${this.ASAAS_API_URL}/customers`, {
      method: 'POST',
      headers: {
        'access_token': this.ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: tenant.name,
        email: tenant.email,
        cpfCnpj: tenant.document || '00000000000',
      }),
    });
    const data = await res.json();

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { asaasCustomerId: data.id },
    });

    return data.id;
  }

  async getInvoices(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRevenue() {
    const result = await this.prisma.invoice.aggregate({
      where: { status: 'paid' },
      _sum: { amount: true },
    });
    return { totalRevenue: result._sum.amount || 0 };
  }
}
