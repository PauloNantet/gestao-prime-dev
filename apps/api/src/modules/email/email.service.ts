import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly RESEND_API_KEY = process.env.RESEND_API_KEY || '';
  private readonly FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@gestaoprime.com.br';

  async sendWelcome(to: string, name: string, slug: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0056b3;">Bem-vindo à Gestão Prime!</h1>
        <p>Olá <strong>${name}</strong>,</p>
        <p>Sua conta foi ativada com sucesso! Seus aplicativos já estão sendo provisionados.</p>
        <p>Em breve você receberá os links de acesso.</p>
        <hr style="border: 1px solid #eee;" />
        <p style="color: #666; font-size: 12px;">Equipe Gestão Prime</p>
      </div>
    `;

    return this.send(to, 'Bem-vindo à Gestão Prime!', html);
  }

  async sendInvoice(to: string, name: string, amount: string, dueDate: string, pixCode?: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0056b3;">Fatura Gestão Prime</h2>
        <p>Olá <strong>${name}</strong>,</p>
        <p>Sua fatura de <strong>R$ ${amount}</strong> vence em <strong>${dueDate}</strong>.</p>
        ${pixCode ? `<p>Pix Copia e Cola: <code style="background: #f4f4f4; padding: 8px; display: block; word-break: break-all;">${pixCode}</code></p>` : ''}
        <hr style="border: 1px solid #eee;" />
        <p style="color: #666; font-size: 12px;">Equipe Gestão Prime</p>
      </div>
    `;

    return this.send(to, `Fatura Gestão Prime - R$ ${amount}`, html);
  }

  async sendDeployReady(to: string, name: string, url: string, appName: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0056b3;">${appName} está pronto!</h2>
        <p>Olá <strong>${name}</strong>,</p>
        <p>Seu aplicativo <strong>${appName}</strong> já está no ar!</p>
        <p>Acesse: <a href="${url}" style="color: #0056b3;">${url}</a></p>
        <hr style="border: 1px solid #eee;" />
        <p style="color: #666; font-size: 12px;">Equipe Gestão Prime</p>
      </div>
    `;

    return this.send(to, `${appName} está no ar!`, html);
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.RESEND_API_KEY) {
      console.log(`[EMAIL mock] To: ${to}, Subject: ${subject}`);
      return { sent: true, mock: true };
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.FROM_EMAIL, to, subject, html }),
    });

    return res.json();
  }
}
