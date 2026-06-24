import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Request, type Response, type NextFunction } from 'express';
import * as dotenv from 'dotenv';
import { resolve, join } from 'path';
import { existsSync, statSync } from 'fs';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { AppModule } from './app.module';

async function bootstrap() {
  const server = express();

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

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

  if (process.env.NODE_ENV === 'production') {
    const webDist = resolve('./apps/web/dist');

    if (existsSync(webDist) && statSync(webDist).isDirectory()) {
      server.use(express.static(webDist));

      app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api')) return next();
        const indexPath = join(webDist, 'index.html');
        if (existsSync(indexPath)) {
          return res.sendFile(indexPath);
        }
        next();
      });
    }
  }

  await app.listen(port);
  console.log(`Gestão Prime API running on port ${port}`);
}

bootstrap();
