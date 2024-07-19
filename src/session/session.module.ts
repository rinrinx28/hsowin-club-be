import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionService } from './session.service';
import { Session, SessionSchema } from './schema/session.schema';
import { SessionController } from './session.controller';
import { UserModule } from 'src/user/user.module';
import { CronjobModule } from 'src/cronjob/cronjob.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    UserModule,
    CronjobModule,
  ],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
