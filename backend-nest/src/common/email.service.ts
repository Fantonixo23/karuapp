import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly resend: Resend | null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;

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
    return !!this.resend || !!this.transporter;
  }

  assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Envio de email no configurado (RESEND_API_KEY o SMTP_HOST, SMTP_USER, SMTP_PASS).',
      );
    }
  }

  async sendEmail(to: string, subject: string, text: string): Promise<boolean> {
    this.assertConfigured();

    if (this.resend) {
      try {
        const from = process.env.RESEND_FROM || 'LaCarta <no-reply@lacarta.com>';
        const { error } = await this.resend.emails.send({ from, to, subject, text });
        if (error) throw new Error(error.message);
        this.logger.log(`Email enviado a ${to} (Resend): ${subject}`);
        return true;
      } catch (err: any) {
        this.logger.error(`Error enviando email a ${to} (Resend): ${err.message}`);
        return false;
      }
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@lacarta.com';
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
