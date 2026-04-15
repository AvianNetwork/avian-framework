import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsNotEmpty } from 'class-validator';
import { AuthService } from './auth.service.js';

class ChallengeDto {
  @ApiProperty({ description: 'Avian wallet address to authenticate', example: 'RHb9CdoiuW5oqBzP3gEBJXdEGjPNP5Xsb' })
  @IsString() @IsNotEmpty() address!: string;
}

class VerifyDto {
  @ApiProperty({ description: 'Avian wallet address', example: 'RHb9CdoiuW5oqBzP3gEBJXdEGjPNP5Xsb' })
  @IsString() @IsNotEmpty() address!: string;

  @ApiProperty({ description: 'Challenge string returned by POST /auth/challenge', example: 'avian-framework:auth:deadbeef...' })
  @IsString() @IsNotEmpty() challenge!: string;

  @ApiProperty({ description: 'Base64 signature of the challenge produced by the wallet (verifymessage compatible)', example: 'H1a2B3...' })
  @IsString() @IsNotEmpty() signature!: string;
}

// Auth endpoints are sensitive — tighten to 10 requests per minute
@Throttle({ default: { limit: 10, ttl: 60000 } })
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('challenge')
  @ApiOperation({ summary: 'Request a sign challenge for wallet address' })
  async challenge(@Body() dto: ChallengeDto) {
    return this.auth.issueChallenge(dto.address);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify signed challenge and receive JWT' })
  async verify(@Body() dto: VerifyDto) {
    return this.auth.verifyAndLogin(dto.address, dto.challenge, dto.signature);
  }
}
