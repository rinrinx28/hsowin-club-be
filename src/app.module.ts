import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
// import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientModule } from './client/client.module';
import { UserModule } from './user/user.module';
import { BillModule } from './bill/bill.module';
import { BetLogModule } from './bet-log/bet-log.module';
import { BotModule } from './bot/bot.module';
import { BossModule } from './boss/boss.module';
import { MessagesModule } from './messeges/messeges.module';
import { SessionModule } from './session/session.module';
import { AuthModule } from './auth/auth.module';
import { UnitlService } from './unitl/unitl.service';
import { WebSocketModule } from './socket/socket.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { CronjobModule } from './cronjob/cronjob.module';
import { EventModule } from './event/event.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),
    MongooseModule.forRoot(process.env.DATABASE_URI),
    EventEmitterModule.forRoot(),
    ClientModule,
    UserModule,
    BillModule,
    BetLogModule,
    BotModule,
    BossModule,
    MessagesModule,
    SessionModule,
    AuthModule,
    WebSocketModule,
    CronjobModule,
    EventModule,
  ],
  controllers: [],
  providers: [AppService, UnitlService],
})
export class AppModule {}
