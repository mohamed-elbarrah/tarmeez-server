import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { render } from '@react-email/components';
import { ReactElement } from 'react';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    // ConfigService reads .env as strings — parseInt is required for reliable number casting
    const port = parseInt(this.config.get<string>('SMTP_PORT', '587'), 10);

    this.logger.debug(
      `Resolved SMTP config — host: ${host}, port: ${port}, user: ${user}`,
    );

    if (!host || !user || !pass) {
      this.logger.warn(
        `Mail server unreachable. Proceeding without email. Missing: ${[!host && 'SMTP_HOST', !user && 'SMTP_USER', !pass && 'SMTP_PASS'].filter(Boolean).join(', ')}`,
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    this.isConfigured = true;
  }

  async onModuleInit(): Promise<void> {
    this.logger.debug(
      `Mail Config at init — host: ${this.config.get('SMTP_HOST')}, port: ${this.config.get('SMTP_PORT')}, user: ${this.config.get('SMTP_USER')}, isConfigured: ${this.isConfigured}`,
    );

    if (!this.isConfigured || !this.transporter) return;

    try {
      await this.transporter.verify();
      this.logger.log(
        'Mail server connection verified successfully. Ready to send emails.',
      );
    } catch (err) {
      this.isConfigured = false;
      this.logger.warn(
        `Mail server unreachable. Proceeding without email. Reason: ${(err as Error).message}`,
      );
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    templateComponent: ReactElement,
  ): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
      this.logger.warn(
        `Skipping email to ${to} — mail server is not configured or unreachable.`,
      );
      return;
    }

    try {
      const html = await render(templateComponent);

      await this.transporter.sendMail({
        from: `"${this.config.get<string>('MAIL_FROM_NAME', 'Tarmeez')}" <${this.config.get<string>('SMTP_USER')}>`,
        to,
        subject,
        html,
      });

      this.logger.log(
        `Email sent successfully to ${to} — subject: "${subject}"`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${to} — subject: "${subject}". Reason: ${(err as Error).message}`,
      );
    }
  }
}
