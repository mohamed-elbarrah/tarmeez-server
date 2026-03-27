import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { TeamService } from './team.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

/**
 * Public routes for team invitations — no authentication required.
 * Kept separate from TeamController which is fully guarded by MerchantGuard.
 */
@Controller('merchant/team/invitations')
export class TeamPublicController {
  constructor(private readonly teamService: TeamService) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(@Body() dto: AcceptInvitationDto) {
    return this.teamService.acceptInvitation(dto.token);
  }
}
