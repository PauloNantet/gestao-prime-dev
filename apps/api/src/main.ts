import './env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import path from 'path';
import fs from 'fs';

import { AppModule } from './app.module';

async function bootstrap() {
  const server = express();

  const webDist = path.resolve('./apps/web/dist');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(webDist)) {
    server.use(express.static(webDist));
  }

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  if (process.env.NODE_ENV === 'production' && fs.existsSync(webDist)) {
    app.use((req: any, res: any, next: any) => {
      if (req.path.startsWith('/api')) return next();
      const indexPath = path.join(webDist, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });
  }

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || process.env.API_PORT || 3001;

  await app.listen(port);
  console.log(`Gestão Prime API running on port ${port}`);
}

bootstrap();
