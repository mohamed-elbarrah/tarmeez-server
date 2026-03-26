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
import { TeamService } from './team.service';
import { InviteTeamMemberDto } from './dto/invite-team-member.dto';
import { MerchantGuard } from '../merchant/guards/merchant.guard';

@Controller('merchant/team')
@UseGuards(MerchantGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /**
   * POST /merchant/team/invite
   * Invite a new member to the store team.
   */
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  invite(@Req() req: any, @Body() dto: InviteTeamMemberDto) {
    const storeId: string = req.user.storeId;
    const merchantName: string =
      req.user.merchant?.fullName ?? req.user.email;
    return this.teamService.inviteMember(storeId, merchantName, dto);
  }

  /**
   * GET /merchant/team/members
   * List all members of the store.
   */
  @Get('members')
  listMembers(@Req() req: any) {
    return this.teamService.listMembers(req.user.storeId);
  }

  /**
   * GET /merchant/team/invitations
   * List all pending/sent invitations.
   */
  @Get('invitations')
  listInvitations(@Req() req: any) {
    return this.teamService.listInvitations(req.user.storeId);
  }

  /**
   * DELETE /merchant/team/members/:id
   * Remove a member from the store team.
   */
  @Delete('members/:id')
  removeMember(@Req() req: any, @Param('id') memberId: string) {
    return this.teamService.removeMember(req.user.storeId, memberId);
  }
}
