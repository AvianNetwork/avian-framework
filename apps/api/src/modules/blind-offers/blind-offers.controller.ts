import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  BlindOffersService,
  CreateBlindOfferDto,
  AcceptBlindOfferDto,
} from './blind-offers.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SyncGuard } from '../../guards/sync.guard.js';

@ApiTags('blind-offers')
@Controller('blind-offers')
export class BlindOffersController {
  constructor(private readonly blindOffers: BlindOffersService) {}

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all blind offers submitted by the authenticated buyer' })
  findMine(@CurrentUser() user: { address: string }) {
    return this.blindOffers.findByBuyer(user.address);
  }

  @Get('received')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending blind offers received for assets the caller holds' })
  findReceived(@CurrentUser() user: { address: string }) {
    return this.blindOffers.findReceived(user.address);
  }

  @Get('asset/:assetName')
  @ApiOperation({ summary: 'Get pending blind offers for a specific asset' })
  findByAsset(@Param('assetName') assetName: string) {
    return this.blindOffers.findByAsset(assetName);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a blind offer by ID' })
  findOne(@Param('id') id: string) {
    return this.blindOffers.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), SyncGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a blind offer on an asset (buyer)' })
  create(@CurrentUser() user: { address: string }, @Body() dto: CreateBlindOfferDto) {
    return this.blindOffers.create(user.address, dto);
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a blind offer (seller — must hold the asset)' })
  reject(@Param('id') id: string, @CurrentUser() user: { address: string }) {
    return this.blindOffers.reject(id, user.address);
  }

  @Patch(':id/withdraw')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Withdraw a blind offer (buyer only)' })
  withdraw(@Param('id') id: string, @CurrentUser() user: { address: string }) {
    return this.blindOffers.withdraw(id, user.address);
  }

  @Post(':id/accept')
  @UseGuards(AuthGuard('jwt'), SyncGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a blind offer (seller — provides signed PSBT)' })
  accept(
    @Param('id') id: string,
    @CurrentUser() user: { address: string },
    @Body() dto: AcceptBlindOfferDto,
  ) {
    return this.blindOffers.accept(id, user.address, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a terminal blind offer (buyer only — withdrawn/rejected/expired/completed)' })
  remove(@Param('id') id: string, @CurrentUser() user: { address: string }) {
    return this.blindOffers.deleteTerminal(id, user.address);
  }
}
