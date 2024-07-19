import { Module } from '@nestjs/common';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { BotModule } from 'src/bot/bot.module';
import { SessionModule } from 'src/session/session.module';
import { BossModule } from 'src/boss/boss.module';
import { UserModule } from 'src/user/user.module';
import { UnitlService } from 'src/unitl/unitl.service';
import { WebSocketModule } from 'src/socket/socket.module';
import { BetLogModule } from 'src/bet-log/bet-log.module';
import { CronjobModule } from 'src/cronjob/cronjob.module';

@Module({
  imports: [
    BotModule,
    SessionModule,
    BossModule,
    UserModule,
    WebSocketModule,
    BetLogModule,
    CronjobModule,
  ],
  controllers: [ClientController],
  providers: [ClientService, UnitlService],
})
export class ClientModule {}
