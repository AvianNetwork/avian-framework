import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  MaxFileSizeValidator,
  FileTypeValidator,
  ParseFilePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max, IsArray } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { CollectionsService } from './collections.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

class CreateCollectionDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() twitterHandle?: string;
  @IsOptional() @IsString() discordHandle?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(15) royaltyPercent?: number;
}

class UpdateCollectionDto extends CreateCollectionDto {
  @IsOptional() declare name: string;
}

class AddItemDto {
  @IsString() assetName!: string;
}

class ReorderDto {
  @IsArray() @IsString({ each: true }) order!: string[];
}

function imageStorage(subfolder: string) {
  return diskStorage({
    destination: join(process.cwd(), 'uploads', subfolder),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
  });
}

const imageFilePipe = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
    new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/, fallbackToMimetype: true }),
  ],
  fileIsRequired: false,
});

@ApiTags('collections')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  @ApiOperation({ summary: 'Browse all collections' })
  findAll(@Query('page') page = 1, @Query('filter') filter?: string) {
    return this.collections.findAll(Number(page), filter);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a single collection with its items' })
  findOne(@Param('slug') slug: string) {
    return this.collections.findBySlug(slug);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a collection' })
  create(
    @CurrentUser() user: { address: string; userId: string },
    @Body() dto: CreateCollectionDto,
  ) {
    return this.collections.create(user.address, dto);
  }

  @Patch(':slug')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update collection details' })
  update(
    @Param('slug') slug: string,
    @CurrentUser() user: { address: string; userId: string },
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.collections.update(slug, user.address, dto);
  }

  @Delete(':slug')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a collection' })
  remove(
    @Param('slug') slug: string,
    @CurrentUser() user: { address: string; userId: string },
  ) {
    return this.collections.remove(slug, user.address);
  }

  @Post(':slug/items')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an asset to a collection' })
  addItem(
    @Param('slug') slug: string,
    @CurrentUser() user: { address: string; userId: string },
    @Body() dto: AddItemDto,
  ) {
    return this.collections.addItem(slug, user.address, dto.assetName);
  }

  @Delete(':slug/items/:assetName')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an asset from a collection' })
  removeItem(
    @Param('slug') slug: string,
    @Param('assetName') assetName: string,
    @CurrentUser() user: { address: string; userId: string },
  ) {
    return this.collections.removeItem(slug, user.address, assetName);
  }

  @Patch(':slug/items/reorder')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder collection items' })
  reorder(
    @Param('slug') slug: string,
    @CurrentUser() user: { address: string; userId: string },
    @Body() dto: ReorderDto,
  ) {
    return this.collections.reorderItems(slug, user.address, dto.order);
  }

  @Post(':slug/avatar')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload collection avatar image' })
  @UseInterceptors(FileInterceptor('file', { storage: imageStorage('collections') }))
  async uploadAvatar(
    @Param('slug') slug: string,
    @CurrentUser() user: { address: string; userId: string },
    @UploadedFile(imageFilePipe) file: Express.Multer.File,
  ) {
    return this.collections.updateAvatar(slug, user.address, `/uploads/collections/${file.filename}`);
  }

  @Post(':slug/banner')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload collection banner image' })
  @UseInterceptors(FileInterceptor('file', { storage: imageStorage('collections') }))
  async uploadBanner(
    @Param('slug') slug: string,
    @CurrentUser() user: { address: string; userId: string },
    @UploadedFile(imageFilePipe) file: Express.Multer.File,
  ) {
    return this.collections.updateBanner(slug, user.address, `/uploads/collections/${file.filename}`);
  }
}
