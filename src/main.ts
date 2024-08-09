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
    'http://localhost:3032',
    'https://hsowin.vip',
    'https://www.hsowin.vip',
  ];

  app.enableCors({
    origin: 'https://hsowin.vip', // Replace with your allowed origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
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
