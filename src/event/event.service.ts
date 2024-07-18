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
import { StatusBoss } from 'src/client/dto/client.dto';
import { Mutex } from 'async-mutex'; // Example using async-mutex for locking

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

  private readonly mutexMap = new Map<string, Mutex>();
  private logger: Logger = new Logger('Events');

  @OnEvent('bet-user-ce')
  async handleBetUser(data: CreateUserBet) {
    try {
      const { uid, amount, betId, result, server } = data;
      // Let check timeEnd
      const bet_session = await this.betLogService.findById(betId);
      if (!bet_session || bet_session.isEnd) throw new Error('The bet is stop');

      let current_now = Math.floor(Date.now() / 1000);
      let timeEnd = Math.floor(new Date(bet_session.timeEnd).getTime() / 1000);
      if (timeEnd - current_now <= 20)
        throw new Error('the time to bet is stop');

      // Find User with UID
      const target = await this.userService.findById(uid);
      if (!target) throw new Error('The User is not exist');

      // Check Sv Default of user ...
      let min_amount = 30;
      let max_amount = target?.server === server ? 3000 : 1500;
      let total_amount = target?.server === server ? 8000 : 4000;
      if (target.gold - amount <= 0)
        throw new Error('The Balance is not enough');

      // Let query total amount of sesson Bet
      const old_bet_user = await this.userService.findOneUserBet({
        betId: betId,
        uid: uid,
        isEnd: false,
        server: server,
      });
      let total_bet_user = 0;
      for (const betUser of old_bet_user) {
        total_bet_user += betUser.amount;
      }
      if (total_bet_user + amount > total_amount)
        throw new Error('Limited bet amount');

      // Check min limited bet amount
      if (amount < min_amount) throw new Error('The min bet amount is 30');

      // Check max limited bet amount
      if (amount > max_amount) throw new Error('The max bet amount is 3000');

      // Let minus gold of user
      await this.userService.update(uid, {
        $inc: {
          gold: -amount,
        },
      });

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

  // @OnEvent('result-bet-user')
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

  @OnEvent('status-boss')
  async handleStatusBoss(data: StatusBoss) {
    const parameter = data.server; // Tham số cần lock

    // Tạo mutex cho tham số nếu chưa tồn tại
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const { content, server } = data;
      let new_content = this.unitlService.hexToString(content);
      data.content = new_content;

      // Check spam Boss Status
      const old_server_update = await this.bossService.findServer(server);
      if (old_server_update) {
        let now = Math.floor(Date.now() / 1000);
        let current_update = Math.floor(
          new Date(old_server_update?.updatedAt).getTime() / 1000,
        );
        if (now - current_update < 5) {
          throw new Error('Spam');
        }
      }
      const old_bet = await this.betLogService.findByServer(server);
      if (new_content.includes('Núi khỉ đỏ')) {
        data['type'] = 0;
      } else if (new_content.includes('Núi khỉ đen')) {
        data['type'] = 1;
      } else {
        data['type'] = 2;
      }

      data['respam'] = data['type'] === 2 ? 180 : 0;
      if (data['type'] === 2) {
        if (old_bet) {
          await this.betLogService.update(old_bet?.id, {
            server,
            timeEnd: this.addSeconds(new Date(), 180),
            isEnd: false,
            result: ``,
          });
        } else {
          await this.betLogService.create({
            server,
            timeEnd: this.addSeconds(new Date(), 180),
          });
        }
      } else {
        if (old_bet) {
          await this.handleResultBet({
            betId: old_bet?.id,
            result: `${data['type']}`,
            server: server,
          });
          // Update new total in the Bet
          const update_old = await this.betLogService.findById(old_bet?.id);
          await this.betLogService.update(old_bet?.id, {
            isEnd: true,
            result: `${data['type']}`,
            total: update_old?.sendIn - update_old?.sendOut,
          });
        }
      }
      // Create new Bet
      await this.bossService.createAndUpdate(server, {
        server,
        type: data?.type,
        respam: data?.respam,
      });
      this.socketGateway.server.emit('status-boss', {
        server,
        type: data?.type,
        respam: data?.respam,
      });
      this.logger.log(`Boss Status: ${data.content} - Server: ${data?.server}`);
      return;
    } catch (err) {
      this.logger.log(`Boss Status: ${err.message} - Server: ${data?.server}`);
    } finally {
      release();
    }
  }

  async handleUpdateUserBet(id: any, uid: any, betId: any, data: any) {
    await this.userService.updateBet(id, data);
    if (data?.receive > 0) {
      await this.handleTransactionUserBet(uid, betId, data?.receive);
    }
  }

  async handleTransactionUserBet(id: any, betId: any, amount: number) {
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

  addSeconds(date: Date, seconds: number): Date {
    return new Date(date.getTime() + seconds * 1000);
  }
}
