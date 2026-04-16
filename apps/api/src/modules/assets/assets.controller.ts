import { Controller, Get, Param, Query, Put, Body, UseGuards, Res } from '@nestjs/common';
import { join } from 'path';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, IsUrl } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { AssetsService } from './assets.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

class SetMetadataDto {
  @ApiProperty({ required: false, description: 'Display title for the asset', example: 'My Rare Token' })
  @IsOptional() @IsString() title?: string;

  @ApiProperty({ required: false, description: 'Short description of the asset', example: 'A limited-edition collectible on the Avian network.' })
  @IsOptional() @IsString() description?: string;

  @ApiProperty({ required: false, description: 'External URL for additional asset info', example: 'https://example.com/asset/MY_ASSET' })
  @IsOptional() @IsString() externalUrl?: string;

  @ApiProperty({ required: false, description: 'Array of NFT-style traits', example: [{ trait_type: 'Rarity', value: 'Legendary' }] })
  @IsOptional() @IsArray() traits?: { trait_type: string; value: string | number }[];
}

class SetHolderNoteDto {
  @ApiProperty({ description: 'Private note visible only to the holder', example: 'Bought at genesis auction.' })
  @IsString() note!: string;
}

class SetHolderMetadataDto {
  @ApiProperty({ required: false, description: 'Display title for this holder\'s view', example: 'My Copy' })
  @IsOptional() @IsString() title?: string;

  @ApiProperty({ required: false, description: 'Holder-specific description', example: 'My personal notes about this asset.' })
  @IsOptional() @IsString() description?: string;

  @ApiProperty({ required: false, description: 'External URL', example: 'https://example.com' })
  @IsOptional() @IsString() externalUrl?: string;

  @ApiProperty({ required: false, description: 'Holder-specific traits', example: [{ trait_type: 'Condition', value: 'Mint' }] })
  @IsOptional() @IsArray() traits?: { trait_type: string; value: string | number }[];
}

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}  @Get()
  @ApiOperation({ summary: 'List assets on the Avian network' })
  list(
    @Query('filter') filter?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 50,
    @Query('hasIpfs') hasIpfs?: string
  ) {
    return this.assets.listAssets(filter, Number(page), Number(pageSize), hasIpfs === 'true');
  }

  @Get('address/:address')
  @ApiOperation({ summary: 'Get asset balances for a wallet address' })
  balancesByAddress(@Param('address') address: string) {
    return this.assets.getBalancesByAddress(address);
  }

  @Get('utxos/:address')
  @ApiOperation({ summary: 'Get UTXOs for an address holding a specific asset' })
  assetUtxos(
    @Param('address') address: string,
    @Query('asset') asset: string
  ) {
    return this.assets.getAssetUtxos(address, asset);
  }

  @Get('ipfs/:hash')
  @ApiOperation({ summary: 'Serve a locally-cached IPFS image by hash, or the unpinned placeholder' })
  async serveIpfs(
    @Param('hash') hash: string,
    @Res() res: Response,
  ): Promise<void> {
    const cached = await this.assets.getIpfsCached(hash);
    if (!cached) {
      const fallback = join(process.cwd(), 'public', 'unpinned.png');
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=60');
      res.sendFile(fallback);
      return;
    }
    res.set('Content-Type', cached.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    cached.stream.pipe(res);
  }

  @Get(':name')
  @ApiOperation({ summary: 'Get asset metadata by name' })
  getOne(@Param('name') name: string) {
    return this.assets.getAsset(name);
  }

  @Get(':name/holders')
  @ApiOperation({ summary: 'Get all addresses holding a specific asset' })
  holders(@Param('name') name: string) {
    return this.assets.getHoldersByAsset(name);
  }

  // ─── Asset Metadata ────────────────────────────────────────────────────────

  @Get(':name/metadata')
  @ApiOperation({ summary: 'Get off-chain metadata for an asset' })
  getMetadata(@Param('name') name: string) {
    return this.assets.getAssetMetadata(name);
  }

  @Put(':name/metadata')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set off-chain metadata (must hold the asset)' })
  setMetadata(
    @Param('name') name: string,
    @CurrentUser() user: { address: string },
    @Body() dto: SetMetadataDto,
  ) {
    return this.assets.setAssetMetadata(name, user.address, dto);
  }

  @Get(':name/note')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get your private note for an asset' })
  getNote(
    @Param('name') name: string,
    @CurrentUser() user: { address: string },
  ) {
    return this.assets.getHolderNote(name, user.address);
  }

  @Put(':name/note')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set your private note for an asset' })
  setNote(
    @Param('name') name: string,
    @CurrentUser() user: { address: string },
    @Body() dto: SetHolderNoteDto,
  ) {
    return this.assets.setHolderNote(name, user.address, dto.note);
  }

  // ─── Per-holder public metadata ──────────────────────────────────

  @Get(':name/holder-metadata/:address')
  @ApiOperation({ summary: 'Get public holder metadata for an asset+address pair' })
  getHolderMetadata(
    @Param('name') name: string,
    @Param('address') address: string,
  ) {
    return this.assets.getHolderMetadata(name, address);
  }

  @Put(':name/holder-metadata')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set your public holder metadata for an asset (must hold the asset)' })
  setHolderMetadata(
    @Param('name') name: string,
    @CurrentUser() user: { address: string },
    @Body() dto: SetHolderMetadataDto,
  ) {
    return this.assets.setHolderMetadata(name, user.address, dto);
  }
}
