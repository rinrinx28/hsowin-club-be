import { Module } from '@nestjs/common';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { BotModule } from 'src/bot/bot.module';
import { SessionModule } from 'src/session/session.module';
import { BossModule } from 'src/boss/boss.module';
import { UserModule } from 'src/user/user.module';
import { UnitlService } from 'src/unitl/unitl.service';
import { CronjobService } from 'src/cronjob/cronjob.service';
import { WebSocketModule } from 'src/socket/socket.module';
import { BetLogModule } from 'src/bet-log/bet-log.module';

@Module({
  imports: [
    BotModule,
    SessionModule,
    BossModule,
    UserModule,
    WebSocketModule,
    BetLogModule,
  ],
  controllers: [ClientController],
  providers: [ClientService, UnitlService, CronjobService],
})
export class ClientModule {}
