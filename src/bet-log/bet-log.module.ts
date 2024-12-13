import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BetLogService } from './bet-log.service';
import { BetLogController } from './bet-log.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { BetLog, BetLogSchema } from './schema/bet-log.schema';
import { BetServer, BetServerSchema } from './schema/bet-sv.schema';
import { BetHistorySchema, BetHistory } from './schema/bet-history.schema';
import { EventRandom, EventRandomSchema } from 'src/event/schema/eventRandom';
import { UserBet, UserBetSchema } from 'src/user/schema/userBet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BetLog.name, schema: BetLogSchema },
      { name: BetServer.name, schema: BetServerSchema },
      { name: BetHistory.name, schema: BetHistorySchema },
      { name: EventRandom.name, schema: EventRandomSchema },
      { name: UserBet.name, schema: UserBetSchema },
    ]),
  ],
  controllers: [BetLogController],
  providers: [BetLogService],
  exports: [BetLogService],
})
export class BetLogModule {}
