import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BetLogService } from 'src/bet-log/bet-log.service';
import { BossService } from 'src/boss/boss.service';
import { BotService } from 'src/bot/bot.service';
import { CronjobService } from 'src/cronjob/cronjob.service';
import { SessionService } from 'src/session/session.service';
import { SocketGateway } from 'src/socket/socket.gateway';
import { UnitlService } from 'src/unitl/unitl.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class EventService {
  constructor(
    private readonly socketGateway: SocketGateway,
    private readonly unitlService: UnitlService,
    private readonly botService: BotService,
    private readonly bossService: BossService,
    private readonly sessionService: SessionService,
    private readonly cronJobService: CronjobService,
    private readonly userService: UserService,
    private readonly betLogService: BetLogService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('bet-user')
  handleBetUser(data: any) {
    console.log(data, 'is event bet user');
  }

  @OnEvent('transaction')
  handleTransaction(data: any) {
    console.log(data, 'is event transaction');
  }
}
