import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schema/user.schema';
import { UserBet, UserBetSchema } from './schema/userBet.schema';
import { ClansSchema, Clans } from './schema/clans.schema';
import { Event, EventSchema } from 'src/event/schema/event.schema';
import { UserWithDraw, UserWithDrawSchema } from './schema/userWithdraw';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserBet.name, schema: UserBetSchema },
      { name: Clans.name, schema: ClansSchema },
      { name: Event.name, schema: EventSchema },
      { name: UserWithDraw.name, schema: UserWithDrawSchema },
    ]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
