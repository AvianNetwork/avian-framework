import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { PsbtService, BuildListingPsbtDto, SubmitSignedPsbtDto, BuildGiftPsbtDto, SubmitGiftDto } from './psbt.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SyncGuard } from '../../guards/sync.guard.js';
import { IsString, IsNotEmpty } from 'class-validator';

class DecodePsbtDto {
  @ApiProperty({ description: 'Base64-encoded PSBT to decode for UI display', example: 'cHNidP8B...' })
  @IsString() @IsNotEmpty() psbtBase64!: string;
}

@ApiTags('psbt')
@Controller('psbt')
export class PsbtController {
  constructor(private readonly psbt: PsbtService) {}

  @Post('build/listing')
  @UseGuards(AuthGuard('jwt'), SyncGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Build unsigned listing PSBT for seller to sign' })
  buildListing(@Body() dto: BuildListingPsbtDto) {
    return this.psbt.buildListingPsbt(dto);
  }

  @Post('decode')
  @ApiOperation({ summary: 'Decode a PSBT for UI display' })
  decode(@Body() dto: DecodePsbtDto) {
    return this.psbt.decodePsbt(dto.psbtBase64);
  }

  @Post('submit')
  @UseGuards(AuthGuard('jwt'), SyncGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit buyer-signed PSBT for broadcast' })
  submit(@CurrentUser() user: { address: string }, @Body() dto: SubmitSignedPsbtDto) {
    return this.psbt.submitSignedPsbt(user.address, dto);
  }

  @Post('build/gift')
  @UseGuards(AuthGuard('jwt'), SyncGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Build unsigned gift PSBT for sender to sign' })
  buildGift(@Body() dto: BuildGiftPsbtDto) {
    return this.psbt.buildGiftPsbt(dto);
  }

  @Post('submit/gift')
  @UseGuards(AuthGuard('jwt'), SyncGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit signed gift PSBT for broadcast' })
  submitGift(@CurrentUser() user: { address: string }, @Body() dto: SubmitGiftDto) {
    return this.psbt.submitGift(user.address, dto);
  }
}
