import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return this.users.me(req.user.sub);
  }

  @Get('search')
  search(@Req() req: AuthenticatedRequest, @Query('q') q = '') {
    return this.users.search(q, req.user.sub);
  }
}
