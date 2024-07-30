import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionService } from './session.service';
import { Session, SessionSchema } from './schema/session.schema';
import { SessionController } from './session.controller';
import { UserModule } from 'src/user/user.module';
import { CronjobModule } from 'src/cronjob/cronjob.module';
import { Bank, BankSchema } from './schema/bank.schema';
import { Event, EventSchema } from 'src/event/schema/event.schema';
import { User, UserSchema } from 'src/user/schema/user.schema';
import { UserWithDraw, UserWithDrawSchema } from 'src/user/schema/userWithdraw';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: Bank.name, schema: BankSchema },
      { name: Event.name, schema: EventSchema },
      { name: User.name, schema: UserSchema },
      { name: UserWithDraw.name, schema: UserWithDrawSchema },
    ]),
    UserModule,
    CronjobModule,
  ],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
