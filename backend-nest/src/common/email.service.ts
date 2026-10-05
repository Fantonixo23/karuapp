import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    this.transporter =
      host && user && pass
        ? nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
          })
        : null;
  }

  get isConfigured(): boolean {
    return !!this.transporter;
  }

  assertConfigured(): void {
    if (!this.transporter) {
      throw new ServiceUnavailableException(
        'Envio de email no configurado (SMTP_HOST, SMTP_USER, SMTP_PASS).',
      );
    }
  }

  async sendEmail(to: string, subject: string, text: string): Promise<boolean> {
    this.assertConfigured();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@karuapp.com';
    try {
      await this.transporter!.sendMail({ from, to, subject, text });
      this.logger.log(`Email enviado a ${to}: ${subject}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Error enviando email a ${to}: ${err.message}`);
      return false;
    }
  }
}
