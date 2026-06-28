export enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  amount: number;
  status: InvoiceStatus;
  paymentMethod: string | null;
  pixQrCode: string | null;
  pixCopiaCola: string | null;
  asaasInvoiceId: string | null;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
}
