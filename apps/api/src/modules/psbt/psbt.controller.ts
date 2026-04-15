import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PsbtService, BuildListingPsbtDto, SubmitSignedPsbtDto } from './psbt.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { IsString, IsNotEmpty } from 'class-validator';

class DecodePsbtDto {
  @IsString() @IsNotEmpty() psbtBase64!: string;
}

@ApiTags('psbt')
@Controller('psbt')
export class PsbtController {
  constructor(private readonly psbt: PsbtService) {}

  @Post('build/listing')
  @UseGuards(AuthGuard('jwt'))
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
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit buyer-signed PSBT for broadcast' })
  submit(@CurrentUser() user: { address: string }, @Body() dto: SubmitSignedPsbtDto) {
    return this.psbt.submitSignedPsbt(user.address, dto);
  }
}
