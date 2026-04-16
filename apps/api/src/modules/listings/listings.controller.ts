import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ListingsService, CreateListingDto } from './listings.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SyncGuard } from '../../guards/sync.guard.js';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @ApiOperation({ summary: 'Browse active listings' })
  findAll(
    @Query('asset') asset?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('seller') seller?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sort') sort?: string,
  ) {
    return this.listings.findAll(
      asset,
      Number(page),
      Number(pageSize),
      seller,
      minPrice != null ? Number(minPrice) : undefined,
      maxPrice != null ? Number(maxPrice) : undefined,
      (sort as 'newest' | 'oldest' | 'price_asc' | 'price_desc') ?? 'newest',
    );
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), SyncGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new listing (requires signed PSBT)' })
  create(@CurrentUser() user: { address: string; userId: string }, @Body() dto: CreateListingDto) {
    return this.listings.create(user.address, user.userId, dto);
  }

  @Get('sales/by-address')
  @ApiOperation({ summary: 'Get completed sales for an address (as buyer or seller)' })
  getSales(
    @Query('address') address: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.listings.getSales(address, Number(page), Number(pageSize));
  }

  @Get('history/:assetName')
  @ApiOperation({ summary: 'Get trade history for a specific asset' })
  getAssetHistory(
    @Param('assetName') assetName: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.listings.getAssetHistory(assetName, Number(page), Number(pageSize));
  }

  @Get('activity')
  @ApiOperation({ summary: 'Global activity feed — recent completed sales' })
  getActivityFeed(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 30,
  ) {
    return this.listings.getActivityFeed(Number(page), Number(pageSize));
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get marketplace stats; pass ?asset= for per-asset stats' })
  getStats(@Query('asset') asset?: string) {
    return this.listings.getStats(asset);
  }

  // :id must come AFTER all static routes so NestJS doesn't match
  // "activity", "stats", etc. as an ID parameter.
  @Get(':id')
  @ApiOperation({ summary: 'Get listing by ID' })
  findOne(@Param('id') id: string) {
    return this.listings.findOne(id);
  }

  @Patch(':id/cancel')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel your listing' })
  cancel(@Param('id') id: string, @CurrentUser() user: { address: string }) {
    return this.listings.cancel(id, user.address);
  }
}
