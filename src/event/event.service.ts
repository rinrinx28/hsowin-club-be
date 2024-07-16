import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BetLogService } from 'src/bet-log/bet-log.service';
import { BossService } from 'src/boss/boss.service';
import { BotService } from 'src/bot/bot.service';
import { CronjobService } from 'src/cronjob/cronjob.service';
import { SessionService } from 'src/session/session.service';
import { CreateUserBet } from 'src/socket/dto/socket.dto';
import { SocketGateway } from 'src/socket/socket.gateway';
import { UnitlService } from 'src/unitl/unitl.service';
import { UserService } from 'src/user/user.service';
import { MessageResult, ResultBet } from './dto/event.dto';

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
  ) {}

  private logger: Logger = new Logger('Events');

  @OnEvent('bet-user-ce')
  async handleBetUser(data: CreateUserBet) {
    try {
      const { uid, amount, betId, result, server } = data;
      // Let check timeEnd
      const bet_session = await this.betLogService.findByServer(server);
      if (!bet_session) throw new Error('The bet is stop');

      let current_now = Math.floor(Date.now() / 1000);
      let timeEnd = Math.floor(new Date(bet_session.timeEnd).getTime() / 1000);
      if (timeEnd - current_now <= 20)
        throw new Error('the time to bet is stop');

      // Find User with UID
      const target = await this.userService.findById(uid);
      if (!target) throw new Error('The User is not exist');

      // Check Sv Default of user ...
      if (target.gold - amount <= 0)
        throw new Error('The Balance is not enough');

      // Let minus gold of user
      await this.userService.update(uid, {
        $inc: {
          gold: -amount,
        },
      });
      // Let query total amount of sesson Bet
      const old_bet_user = await this.userService.findOneUserBet({
        betId: betId,
        id: uid,
        isEnd: false,
        server: server,
      });
      const total_bet_user = old_bet_user.reduce((a, b) => a + b.amount, 0);
      if (total_bet_user >= 3000) throw new Error('Limited Amount Of Bets');

      // Let create new Bet
      const betCreate = await this.userService.createBet({
        amount,
        betId,
        result,
        server,
        uid,
      });

      // Let update sendIn The bet
      await this.betLogService.update(betId, {
        $inc: {
          sendIn: +amount,
        },
      });
      const msg = this.handleMessageResult({
        message: 'The bet is success',
        status: true,
        data: [betCreate],
      });
      this.socketGateway.server.emit('re-bet-user-ce', msg);
      return msg;
    } catch (err) {
      const msg = this.handleMessageResult({
        message: err.message,
        status: false,
        data: [],
      });
      this.socketGateway.server.emit('re-bet-user-ce', msg);
      return msg;
    }
  }

  @OnEvent('result-bet-user')
  async handleResultBet(data: ResultBet) {
    const { betId, result, server } = data;
    try {
      // Let find all betUser with BetId
      const betusers = await this.userService.findBetWithBetId(betId, server);
      if (betusers.length === 0) throw new Error('Everyone no bet');
      let precent = 1.9;
      let newBetUser = [];
      for (let bet of betusers) {
        if (bet.result === result) {
          bet.receive = bet.amount * precent;
        }
        await this.handleUpdateUserBet(bet.id, bet.uid, betId, {
          resultBet: result,
          receive: bet.receive,
          isEnd: true,
        });
        newBetUser.push(bet);
      }
      const msg = this.handleMessageResult({
        message: `result-bet-user-${server}`,
        status: true,
        data: newBetUser,
      });
      console.log(newBetUser);
      return msg;
    } catch (err) {
      const msg = this.handleMessageResult({
        message: err.message,
        status: false,
        data: [],
      });
      return msg;
    }
  }

  @OnEvent('transaction')
  handleTransaction(data: any) {
    console.log(data, 'is event transaction');
  }

  handleMessageResult(msg: MessageResult) {
    return msg;
  }

  async handleUpdateUserBet(id: any, uid: any, betId: any, data: any) {
    await this.userService.updateBet(id, data);
    if (data?.receive > 0) {
      await this.handleTransactionUserBet(uid, betId, data?.receive);
    }
  }

  async handleTransactionUserBet(id: any, betId, amount: number) {
    await this.userService.update(id, {
      $inc: {
        gold: +amount,
      },
    });
    await this.betLogService.update(betId, {
      $inc: {
        sendOut: +amount,
      },
    });
  }
}
