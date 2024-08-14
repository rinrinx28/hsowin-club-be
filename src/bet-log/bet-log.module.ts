import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BetLogService } from './bet-log.service';
import { BetLogController } from './bet-log.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { BetLog, BetLogSchema } from './schema/bet-log.schema';
import { BetServer, BetServerSchema } from './schema/bet-sv.schema';
import { BetHistorySchema, BetHistory } from './schema/bet-history.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BetLog.name, schema: BetLogSchema },
      { name: BetServer.name, schema: BetServerSchema },
      { name: BetHistory.name, schema: BetHistorySchema },
    ]),
  ],
  controllers: [BetLogController],
  providers: [BetLogService],
  exports: [BetLogService],
})
export class BetLogModule {}
