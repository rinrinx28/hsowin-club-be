import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schema/user.schema';
import { UserBet, UserBetSchema } from './schema/userBet.schema';
import { ClansSchema, Clans } from './schema/clans.schema';
import { Event, EventSchema } from 'src/event/schema/event.schema';
import { UserWithDraw, UserWithDrawSchema } from './schema/userWithdraw';
import { UserIp, UserIpSchema } from './schema/userIp.schema';
import { UserPrize, UserPrizeSchema } from './schema/prize.schema';
import { UserActive, UserActiveSchema } from './schema/userActive';
import { UserVip, UserVipSchema } from './schema/userVip.schema';
import { MissionDaily, MissionDailySchema } from './schema/missionDaily.schema';
import { PenningClans, PenningClansSchema } from './schema/PenningClans.schema';
import { TopBank, TopBankSchema } from './schema/topBank.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserBet.name, schema: UserBetSchema },
      { name: Clans.name, schema: ClansSchema },
      { name: Event.name, schema: EventSchema },
      { name: UserWithDraw.name, schema: UserWithDrawSchema },
      { name: UserIp.name, schema: UserIpSchema },
      { name: UserPrize.name, schema: UserPrizeSchema },
      { name: UserActive.name, schema: UserActiveSchema },
      { name: UserVip.name, schema: UserVipSchema },
      { name: MissionDaily.name, schema: MissionDailySchema },
      { name: PenningClans.name, schema: PenningClansSchema },
      { name: TopBank.name, schema: TopBankSchema },
    ]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
