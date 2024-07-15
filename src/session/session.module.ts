import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionService } from './session.service';
import { Session, SessionSchema } from './schema/session.schema';
import { SessionController } from './session.controller';
import { UserModule } from 'src/user/user.module';
import { CronjobService } from 'src/cronjob/cronjob.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    UserModule,
  ],
  controllers: [SessionController],
  providers: [SessionService, CronjobService],
  exports: [SessionService],
})
export class SessionModule {}
