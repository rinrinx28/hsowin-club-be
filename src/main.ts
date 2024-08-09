import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationFilter } from './common/fillter/validation.fillter';
import { HttpStatus, Logger, ValidationPipe } from '@nestjs/common';
import { ExceptionResponse } from './common/common.exception';
import { UtilCommonTemplate } from './common/ultis/utils.common';
import { ValidationError } from 'class-validator';

async function bootstrap() {
  // // Define an array of allowed origins
  const allowedOrigins = ['https://hsowin.vip'];
  const app = await NestFactory.create(AppModule, {
    cors: {
      credentials: true,
      origin: allowedOrigins,
    },
  });
  const logger = new Logger('AppLogger');

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
