import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  OffersService,
  CreateOfferDto,
  CombineOfferPsbtDto,
  CompleteOfferDto,
} from './offers.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all offers made by the authenticated buyer' })
  findMine(@CurrentUser() user: { address: string }) {
    return this.offers.findByBuyer(user.address);
  }

  @Get('listing/:listingId')
  @ApiOperation({ summary: 'Get pending and accepted offers for a listing' })
  findByListing(@Param('listingId') listingId: string) {
    return this.offers.findByListing(listingId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get offer by ID' })
  findOne(@Param('id') id: string) {
    return this.offers.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Make an offer on a listing' })
  create(@CurrentUser() user: { address: string }, @Body() dto: CreateOfferDto) {
    return this.offers.create(user.address, dto);
  }

  @Patch(':id/accept')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept an offer (seller only)' })
  accept(@Param('id') id: string, @CurrentUser() user: { address: string }) {
    return this.offers.accept(id, user.address);
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject an offer (seller only)' })
  reject(@Param('id') id: string, @CurrentUser() user: { address: string }) {
    return this.offers.reject(id, user.address);
  }

  @Patch(':id/withdraw')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Withdraw your offer (buyer only)' })
  withdraw(@Param('id') id: string, @CurrentUser() user: { address: string }) {
    return this.offers.withdraw(id, user.address);
  }

  @Get(':id/funding-info')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get seller UTXO info needed to build the buyer funding PSBT' })
  getFundingInfo(@Param('id') id: string) {
    return this.offers.getFundingInfo(id);
  }

  @Post(':id/combine-psbt')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Combine seller listing PSBT with buyer funding PSBT (buyer only)' })
  combinePsbt(
    @Param('id') id: string,
    @CurrentUser() user: { address: string },
    @Body() dto: CombineOfferPsbtDto,
  ) {
    return this.offers.combinePsbt(id, user.address, dto);
  }

  @Post(':id/complete')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalize and broadcast the buyer-signed PSBT (buyer only)' })
  complete(
    @Param('id') id: string,
    @CurrentUser() user: { address: string },
    @Body() dto: CompleteOfferDto,
  ) {
    return this.offers.complete(id, user.address, dto);
  }
}
