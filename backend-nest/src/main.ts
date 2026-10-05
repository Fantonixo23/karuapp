import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.use((req: any, res: any, next: any) => {
    if (req.path.length > 1 && req.path.endsWith('/')) {
      req.url = req.path.slice(0, -1) + (req.url.slice(req.path.length) || '');
    }
    next();
  });

  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));



  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Karuapp Backend running on http://localhost:${port}`);
}
bootstrap();
