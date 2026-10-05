import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  get isConfigured(): boolean {
    return !!this.transporter;
  }

  async sendEmail(to: string, subject: string, text: string): Promise<boolean> {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@karuapp.com';
    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${to} — ${subject}: ${text}`);
      return true;
    }
    try {
      await this.transporter.sendMail({ from, to, subject, text });
      this.logger.log(`Email enviado a ${to}: ${subject}`);
      return true;
    } catch (err) {
      this.logger.error(`Error enviando email a ${to}: ${err.message}`);
      return false;
    }
  }
}
