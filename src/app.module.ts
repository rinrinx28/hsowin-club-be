import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
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
import { CronjobService } from './cronjob/cronjob.service';
import { UnitlService } from './unitl/unitl.service';
import { WebSocketModule } from './socket/socket.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventService } from './event/event.service';

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [AppService, CronjobService, UnitlService, EventService],
})
export class AppModule {}
