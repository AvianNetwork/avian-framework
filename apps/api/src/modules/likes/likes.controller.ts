import { Controller, Get, Post, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { LikesService } from './likes.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('likes')
export class LikesController {
  constructor(private readonly likes: LikesService) {}

  /** Public: get like count + (optionally) whether a given address liked it */
  @SkipThrottle()
  @Get(':type/:id')
  getCount(
    @Param('type') type: string,
    @Param('id') id: string,
    @Query('address') address?: string,
  ) {
    return this.likes.getCount(type, id, address);
  }

  /** Authenticated: toggle like on/off, returns new state */
  @Post(':type/:id')
  @UseGuards(AuthGuard('jwt'))
  like(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser() user: { address: string },
  ) {
    return this.likes.toggle(type, id, user.address);
  }

  @Delete(':type/:id')
  @UseGuards(AuthGuard('jwt'))
  unlike(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser() user: { address: string },
  ) {
    return this.likes.unlike(type, id, user.address);
  }
}
