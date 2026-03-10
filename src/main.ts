import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
const cookieParser = require('cookie-parser');
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // debug: ensure cookieParser is a function and returns a middleware
  console.log('cookieParser type:', typeof cookieParser);
  try {
    const cp = cookieParser();
    console.log('cookieParser() type:', typeof cp);
    // wrap the middleware to ensure Express receives a standard function
    app.use((req, res, next) => cp(req, res, next));
  } catch (err) {
    console.error('cookieParser init error', err);
    throw err;
  }
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      console.log('Validation errors:', JSON.stringify(errors, null, 2));
      return new BadRequestException(errors);
    },
  }));

  // serve uploaded files from /uploads
  app.useStaticAssets(join(__dirname, '..', 'uploads'));

  app.enableCors({
    origin: configService.get<string>('CLIENT_URL'),
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();

