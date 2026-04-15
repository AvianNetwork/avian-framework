import { Controller, Post, Delete, Get, Param, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WatchesService } from './watches.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('watches')
@UseGuards(AuthGuard('jwt'))
export class WatchesController {
  constructor(private readonly watches: WatchesService) {}

  @Post(':address')
  @HttpCode(204)
  watch(
    @Param('address') watchedAddress: string,
    @CurrentUser() user: { address: string },
  ) {
    return this.watches.watch(user.address, watchedAddress);
  }

  @Delete(':address')
  @HttpCode(204)
  unwatch(
    @Param('address') watchedAddress: string,
    @CurrentUser() user: { address: string },
  ) {
    return this.watches.unwatch(user.address, watchedAddress);
  }

  @Get('status/:address')
  getStatus(
    @Param('address') watchedAddress: string,
    @CurrentUser() user: { address: string },
  ) {
    return this.watches.getStatus(user.address, watchedAddress);
  }
}
