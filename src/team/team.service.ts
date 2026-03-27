import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
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
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  async inviteMember(
    storeId: string,
    userId: string,
    dto: InviteTeamMemberDto,
  ) {
    // Verify store exists and resolve merchant display name in parallel
    const [store, merchant] = await Promise.all([
      this.prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true },
      }),
      this.prisma.merchant.findUnique({
        where: { userId },
        select: { fullName: true },
      }),
    ]);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const merchantName = merchant?.fullName ?? 'صاحب المتجر';

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

    const baseUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const invitationUrl = `${baseUrl}/invite/accept?token=${token}`;

    try {
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
    } catch (err) {
      this.logger.error(
        `Failed to send invitation email to ${dto.email}: ${(err as Error).message}`,
      );
    }

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

  async cancelInvitation(storeId: string, invitationId: string) {
    const invitation = await this.prisma.storeInvitation.findFirst({
      where: { id: invitationId, storeId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    await this.prisma.storeInvitation.update({
      where: { id: invitationId },
      data: { status: 'CANCELLED' },
    });
    return { success: true };
  }

  async acceptInvitation(token: string) {
    const invitation = await this.prisma.storeInvitation.findUnique({
      where: { token },
      include: { store: { select: { id: true, name: true } } },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(
        invitation.status === 'ACCEPTED'
          ? 'This invitation has already been accepted'
          : 'This invitation is no longer valid',
      );
    }

    if (new Date() > invitation.expiresAt) {
      await this.prisma.storeInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('This invitation has expired');
    }

    // Check if a platform user with this email already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { email: invitation.email },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.storeInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      if (existingUser) {
        // Create (or update) the StoreMember record immediately
        await tx.storeMember.upsert({
          where: {
            userId_storeId: {
              userId: existingUser.id,
              storeId: invitation.storeId,
            },
          },
          create: {
            userId: existingUser.id,
            storeId: invitation.storeId,
            role: invitation.role,
          },
          update: { role: invitation.role },
        });
      }
    });

    return {
      email: invitation.email,
      role: invitation.role,
      storeName: invitation.store.name,
      userExists: !!existingUser,
    };
  }
}
