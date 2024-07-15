import { Module } from '@nestjs/common';
import { BetLogService } from './bet-log.service';
import { BetLogController } from './bet-log.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { BetLog, BetLogSchema } from './schema/bet-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BetLog.name, schema: BetLogSchema }]),
  ],
  controllers: [BetLogController],
  providers: [BetLogService],
  exports: [BetLogService],
})
export class BetLogModule {}
