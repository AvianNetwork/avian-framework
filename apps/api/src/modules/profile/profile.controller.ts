import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  MaxFileSizeValidator,
  FileTypeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { ProfileService } from './profile.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'satoshi', description: 'Unique username (3-30 chars, alphanumeric/_/-)' })
  @IsOptional() @IsString() @Length(3, 30) @Matches(/^[a-zA-Z0-9_-]+$/) username?: string;

  @ApiProperty({ required: false, example: 'Satoshi Nakamoto' })
  @IsOptional() @IsString() @Length(1, 60) displayName?: string;

  @ApiProperty({ required: false, example: 'Building on Avian Network.' })
  @IsOptional() @IsString() @Length(0, 500) bio?: string;

  @ApiProperty({ required: false, example: 'https://example.com' })
  @IsOptional() @IsString() website?: string;

  @ApiProperty({ required: false, example: 'aviannetwork' })
  @IsOptional() @IsString() twitterHandle?: string;

  @ApiProperty({ required: false, example: 'aviannetwork' })
  @IsOptional() @IsString() discordHandle?: string;

  @ApiProperty({ required: false, example: '50% 30%', description: 'CSS background-position value for banner crop' })
  @IsOptional() @IsString() @Matches(/^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/) bannerPosition?: string;
}

class LinkWalletDto {
  @ApiProperty({ example: 'RAvianAddress1234567890abcdefghijklmnopqrst', description: 'The new wallet address to link' })
  @IsString() newAddress!: string;

  @ApiProperty({ example: 'avian-link:abc123:1713600000000', description: 'Challenge string from POST /profile/wallets/challenge' })
  @IsString() challenge!: string;

  @ApiProperty({ example: 'H1a2b3c4d5e6f7...', description: 'Message signed by the new wallet private key' })
  @IsString() signature!: string;

  @ApiProperty({ required: false, example: 'Hardware wallet' })
  @IsOptional() @IsString() label?: string;
}

function imageStorage(subfolder: string) {
  return diskStorage({
    destination: join(process.cwd(), 'uploads', subfolder),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
  });
}

const imageFilePipe = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5 MB
    new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/, fallbackToMimetype: true }),
  ],
  fileIsRequired: false,
});

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get own profile' })
  getMe(@CurrentUser() user: { address: string; userId: string }) {
    return this.profile.getMyProfile(user.userId);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own profile' })
  updateMe(
    @CurrentUser() user: { address: string; userId: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profile.updateProfile(user.userId, dto);
  }

  @Post('me/avatar')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload profile avatar' })
  @UseInterceptors(FileInterceptor('file', { storage: imageStorage('avatars') }))
  async uploadAvatar(
    @CurrentUser() user: { address: string; userId: string },
    @UploadedFile(imageFilePipe) file: Express.Multer.File,
  ) {
    const url = `/uploads/avatars/${file.filename}`;
    return this.profile.updateAvatar(user.userId, url);
  }

  @Post('me/banner')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload profile banner' })
  @UseInterceptors(FileInterceptor('file', { storage: imageStorage('banners') }))
  async uploadBanner(
    @CurrentUser() user: { address: string; userId: string },
    @UploadedFile(imageFilePipe) file: Express.Multer.File,
  ) {
    const url = `/uploads/banners/${file.filename}`;
    return this.profile.updateBanner(user.userId, url);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get public profile by username' })
  getPublic(@Param('username') username: string) {
    return this.profile.getPublicProfile(username);
  }

  // ─── Wallet Linking ──────────────────────────────────────────────────────

  @Post('wallets/challenge')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a link-wallet challenge for a new address' })
  issueLinkChallenge(@Body() body: { newAddress: string }) {
    return this.profile.issueLinkChallenge(body.newAddress);
  }

  @Post('wallets')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link a new wallet address to your account' })
  linkWallet(
    @CurrentUser() user: { address: string; userId: string },
    @Body() dto: LinkWalletDto,
  ) {
    return this.profile.confirmWalletLink(user.userId, dto.newAddress, dto.challenge, dto.signature, dto.label);
  }

  @Patch('wallets/:address')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the label of a linked wallet' })
  updateWalletLabel(
    @CurrentUser() user: { address: string; userId: string },
    @Param('address') address: string,
    @Body() body: { label?: string },
  ) {
    return this.profile.updateWalletLabel(user.userId, address, body.label ?? null);
  }

  @Patch('wallets/:address/primary')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a linked wallet as the display primary' })
  setDisplayPrimary(
    @CurrentUser() user: { address: string; userId: string },
    @Param('address') address: string,
  ) {
    return this.profile.setDisplayPrimary(user.userId, address);
  }

  @Delete('wallets/:address')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink a wallet address from your account' })
  unlinkWallet(
    @CurrentUser() user: { address: string; userId: string },
    @Param('address') address: string,
  ) {
    return this.profile.unlinkWallet(user.userId, address);
  }
}
