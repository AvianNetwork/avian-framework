import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Ensure upload directories exist
  const uploadDirs = ['avatars', 'banners', 'collections'].map((d) =>
    join(process.cwd(), 'uploads', d)
  );
  for (const dir of uploadDirs) mkdirSync(dir, { recursive: true });

  // Serve uploaded files as static assets
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.use(helmet());

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Avian Network API')
    .setDescription('PSBT asset marketplace and workflow coordination API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env['PORT'] ?? 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
