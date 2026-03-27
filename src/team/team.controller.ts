import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { TeamService } from './team.service';
import { InviteTeamMemberDto } from './dto/invite-team-member.dto';
import { MerchantGuard } from '../merchant/guards/merchant.guard';
import { Action } from '../common/enums/action.enum';
import { Resource } from '../common/enums/resource.enum';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('merchant/team')
@UseGuards(MerchantGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /**
   * POST /merchant/team/invite
   * Invite a new member to the store team.
   */
  @Post('invite')
  @Permissions(Resource.TEAM, Action.CREATE)
  @HttpCode(HttpStatus.CREATED)
  invite(@Req() req: Request, @Body() dto: InviteTeamMemberDto) {
    return this.teamService.inviteMember(req.activeStore.id, req.user.id, dto);
  }

  /**
   * GET /merchant/team/members
   * List all members of the store.
   */
  @Get('members')
  @Permissions(Resource.TEAM, Action.READ)
  listMembers(@Req() req: Request) {
    return this.teamService.listMembers(req.activeStore.id);
  }

  /**
   * GET /merchant/team/invitations
   * List all pending/sent invitations.
   */
  @Get('invitations')
  @Permissions(Resource.TEAM, Action.READ)
  listInvitations(@Req() req: Request) {
    return this.teamService.listInvitations(req.activeStore.id);
  }

  /**
   * DELETE /merchant/team/members/:id
   * Remove a member from the store team.
   */
  @Delete('members/:id')
  @Permissions(Resource.TEAM, Action.DELETE)
  removeMember(@Req() req: Request, @Param('id') memberId: string) {
    return this.teamService.removeMember(req.activeStore.id, memberId);
  }

  /**
   * DELETE /merchant/team/invitations/:id
   * Cancel a pending invitation.
   */
  @Delete('invitations/:id')
  @Permissions(Resource.TEAM, Action.DELETE)
  cancelInvitation(@Req() req: Request, @Param('id') invitationId: string) {
    return this.teamService.cancelInvitation(req.activeStore.id, invitationId);
  }
}

