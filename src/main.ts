import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationFilter } from './common/fillter/validation.fillter';
import { HttpStatus, Logger, ValidationPipe } from '@nestjs/common';
import { ExceptionResponse } from './common/common.exception';
import { UtilCommonTemplate } from './common/ultis/utils.common';
import { ValidationError } from 'class-validator';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('AppLogger');

  // Define an array of allowed origins
  const allowedOrigins = [
    'http://localhost:3000',
    'https://hsgame.me',
    'https://www.hsgame.me',
    'https://admin.hsgame.me',
    'https://www.admin.hsgame.me',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  });

  app.useGlobalFilters(new ValidationFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      exceptionFactory(errors: ValidationError[]) {
        logger.error(errors);
        return new ExceptionResponse(
          HttpStatus.BAD_REQUEST,
          UtilCommonTemplate.getMessageValidator(errors),
        );
      },
    }),
  );
  await app.listen(3031);
}
bootstrap();
