import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { render } from '@react-email/components';
import { ReactElement } from 'react';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<number>('SMTP_PORT', 587) === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendEmail(
    to: string,
    subject: string,
    templateComponent: ReactElement,
  ): Promise<void> {
    const html = await render(templateComponent);

    await this.transporter.sendMail({
      from: `"${this.config.get<string>('MAIL_FROM_NAME', 'Tarmeez')}" <${this.config.get<string>('SMTP_USER')}>`,
      to,
      subject,
      html,
    });

    this.logger.log(`Email sent to ${to} — subject: "${subject}"`);
  }
}
