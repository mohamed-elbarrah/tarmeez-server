import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { InviteTeamMemberDto } from './dto/invite-team-member.dto';
import { StoreRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as React from 'react';
import { TeamInvitationEmail } from '../mail/templates/TeamInvitation';

@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  async inviteMember(
    storeId: string,
    merchantName: string,
    dto: InviteTeamMemberDto,
  ) {
    // Verify store exists
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // Check for existing pending invitation for same email + store
    const existingInvitation = await this.prisma.storeInvitation.findFirst({
      where: {
        storeId,
        email: dto.email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvitation) {
      throw new ConflictException(
        'An active invitation already exists for this email',
      );
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const invitation = await this.prisma.storeInvitation.create({
      data: {
        email: dto.email,
        storeId,
        role: dto.role,
        token,
        expiresAt,
      },
    });

    const baseUrl = this.config.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const invitationUrl = `${baseUrl}/invite/accept?token=${token}`;

    await this.mail.sendEmail(
      dto.email,
      `دعوة للانضمام إلى فريق متجر ${store.name}`,
      React.createElement(TeamInvitationEmail, {
        merchantName,
        storeName: store.name,
        invitationUrl,
        role: dto.role,
      }),
    );

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
    };
  }

  async listMembers(storeId: string) {
    return this.prisma.storeMember.findMany({
      where: { storeId },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listInvitations(storeId: string) {
    return this.prisma.storeInvitation.findMany({
      where: { storeId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeMember(storeId: string, memberId: string) {
    const member = await this.prisma.storeMember.findFirst({
      where: { id: memberId, storeId },
    });
    if (!member) {
      throw new NotFoundException('Team member not found');
    }
    if (member.role === StoreRole.OWNER) {
      throw new ConflictException('Cannot remove the store owner');
    }
    await this.prisma.storeMember.delete({ where: { id: memberId } });
    return { success: true };
  }
}
