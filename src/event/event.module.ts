import { Module } from '@nestjs/common';
import { BetLogModule } from 'src/bet-log/bet-log.module';
import { BillModule } from 'src/bill/bill.module';
import { BossModule } from 'src/boss/boss.module';
import { BotModule } from 'src/bot/bot.module';
import { ClientModule } from 'src/client/client.module';
import { SessionModule } from 'src/session/session.module';
import { UserModule } from 'src/user/user.module';
import { EventService } from './event.service';
import { UnitlService } from 'src/unitl/unitl.service';
import { WebSocketModule } from 'src/socket/socket.module';
import { MongooseModule } from '@nestjs/mongoose';
import { EventConfig, EventConfigSchema } from './schema/event.schema';
import { CronjobModule } from 'src/cronjob/cronjob.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventConfig.name, schema: EventConfigSchema },
    ]),
    ClientModule,
    BossModule,
    BetLogModule,
    BillModule,
    BotModule,
    SessionModule,
    UserModule,
    WebSocketModule,
    CronjobModule,
  ],
  providers: [EventService, UnitlService],
  exports: [EventService],
})
export class EventModule {}
