import { Module } from '@nestjs/common';
import { BetLogModule } from 'src/bet-log/bet-log.module';
import { BossModule } from 'src/boss/boss.module';
import { BotModule } from 'src/bot/bot.module';
import { ClientModule } from 'src/client/client.module';
import { SessionModule } from 'src/session/session.module';
import { UserModule } from 'src/user/user.module';
import { EventService } from './event.service';
import { UnitlService } from 'src/unitl/unitl.service';
import { WebSocketModule } from 'src/socket/socket.module';
import { CronjobModule } from 'src/cronjob/cronjob.module';
import { MessagesModule } from 'src/messeges/messeges.module';
import { MongooseModule } from '@nestjs/mongoose';
import { EventRandom, EventRandomSchema } from './schema/eventRandom';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventRandom.name, schema: EventRandomSchema },
    ]),
    ClientModule,
    BossModule,
    BetLogModule,
    BotModule,
    SessionModule,
    UserModule,
    WebSocketModule,
    CronjobModule,
    MessagesModule,
  ],
  providers: [EventService, UnitlService],
  exports: [EventService],
})
export class EventModule {}
