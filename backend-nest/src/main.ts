// Debe ser el primer import: carga el .env antes de que ningun modulo lo lea.
// ConfigModule.forRoot() corre despues (durante el bootstrap) y ya es tarde para
// los modulos que leen process.env al importarse.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import helmet from 'helmet';

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function resolveOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production' && configured.length === 0) {
    throw new Error('CORS_ORIGINS es obligatorio en produccion (lista separada por comas).');
  }

  return [...new Set([...DEV_ORIGINS, ...configured])];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: resolveOrigins(),
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

  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Karuapp Backend running on http://localhost:${port}`);
}
bootstrap();
