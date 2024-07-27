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
import {
  CreateEvent,
  MessageResult,
  ResultBet,
  ResultBetBoss,
} from './dto/event.dto';
import { StatusBoss, StatusServerWithBoss } from 'src/client/dto/client.dto';
import { Mutex } from 'async-mutex';
import { ConfigBet, ConfigBetDiff, ConfigNoti } from 'src/config/config';
import { UserBet } from 'src/user/schema/userBet.schema';

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

  @OnEvent('bet-user-ce-boss')
  async handleBetUser(data: CreateUserBet) {
    const { uid, amount, betId, result, server } = data;
    try {
      // Let check timeEnd
      const bet_session = await this.betLogService.findById(betId);
      if (!bet_session || bet_session.isEnd)
        throw new Error('Ván cược đã kết thúc');

      if (result.length < 1) throw new Error('Xin vui lòng Dự Đoán Kết Quả');

      let current_now = Math.floor(Date.now() / 1000);
      let timeEnd = Math.floor(new Date(bet_session.timeEnd).getTime() / 1000);
      if (timeEnd - current_now < 10)
        throw new Error('Ván cược đã đóng thời gian cược');

      const target = await this.queryRequestUserBet(
        uid,
        betId,
        server,
        amount,
        result,
      );

      // Let minus gold of user
      await this.userService.update(uid, {
        $inc: {
          gold: -amount,
        },
      });
      // let clansObj = JSON.parse(target?.clan);
      // // Check user has in the clan
      // if ('clanId' in clansObj) {
      //   await this.userService.updateTotalBetClans(amount, clansObj?.clanId);
      // }

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
        message: 'Tham gia cược thành công',
        status: true,
        data: [betCreate],
      });
      this.socketGateway.server.emit('re-bet-user-ce-boss', msg);
      if (amount >= ConfigNoti.min) {
        this.socketGateway.server.emit(
          'noti-bet',
          `Người chơi ${target.username} đang chơi lớn cược Boss xuất hiện ở núi khỉ ${result === '0' ? 'đỏ' : 'đen'} ${amount} gold`,
        );
      }
      return msg;
    } catch (err) {
      const msg = this.handleMessageResult({
        message: err.message,
        status: false,
        data: [data],
      });
      this.socketGateway.server.emit('re-bet-user-ce-boss', msg);
      return msg;
    }
  }

  @OnEvent('bet-user-ce-sv')
  async handleBetSvAuto(data: CreateUserBet) {
    const { amount, betId, result, server, uid } = data;
    try {
      // Let check timeEnd
      const bet_session = await this.betLogService.findSvById(betId);
      if (!bet_session || bet_session.isEnd)
        throw new Error('Ván cược đã kết thúc');

      if (result.length < 1) throw new Error('Xin vui lòng Dự Đoán Kết Quả');

      let current_now = Math.floor(Date.now() / 1000);
      let timeEnd = Math.floor(new Date(bet_session.timeEnd).getTime() / 1000);
      if (timeEnd - current_now < 10)
        throw new Error('Ván cược đã đóng thời gian cược');

      const target = await this.queryRequestUserBet(
        uid,
        betId,
        server,
        amount,
        result,
      );

      // Let minus gold of user
      await this.userService.update(uid, {
        $inc: {
          gold: -amount,
        },
      });

      // let clansObj = JSON.parse(target?.clan);
      // // Check user has in the clan
      // if ('clanId' in clansObj) {
      //   await this.userService.updateTotalBetClans(amount, clansObj?.clanId);
      // }
      // Let create new Bet
      const betCreate = await this.userService.createBet({
        amount,
        betId,
        result,
        server,
        uid,
      });

      // Let update sendIn The bet
      await this.betLogService.updateSv(betId, {
        $inc: {
          sendIn: +amount,
        },
      });

      // Update jackpot if it is the server 24/24
      if (bet_session.server === '24') {
        await this.betLogService.createAndUpdateBetHistory(bet_session.server, {
          $inc: {
            jackpot: +amount * 0.1,
          },
        });
      }
      const msg = this.handleMessageResult({
        message: 'Tham gia cược thành công',
        status: true,
        data: [betCreate],
      });
      this.socketGateway.server.emit('re-bet-user-ce-sv', msg);
      if (amount >= ConfigNoti.min) {
        this.socketGateway.server.emit(
          'noti-bet',
          `Người chơi ${target.username} đã lớn ${amount} gold khi cược ${
            result === 'C'
              ? 'Chẵn'
              : result === 'CT'
                ? 'Chẵn và Tài'
                : result === 'CX'
                  ? 'Chẵn và Xĩu'
                  : result === 'L'
                    ? 'Lẽ'
                    : result === 'LT'
                      ? 'Lẽ và Tài'
                      : result === 'LX'
                        ? 'Lẽ và Xĩu'
                        : result === 'T'
                          ? 'Tài'
                          : result === 'X'
                            ? 'Xĩu'
                            : result
          }`,
        );
      }
      return msg;
    } catch (err) {
      const msg = this.handleMessageResult({
        message: err.message,
        status: false,
        data: [data],
      });
      this.socketGateway.server.emit('re-bet-user-ce-sv', msg);
      return msg;
    }
  }

  async handleResultBet(data: ResultBet) {
    const { betId, result, server } = data;
    try {
      // Let find all betUser with BetId
      const betusers = await this.userService.findBetWithBetId(betId, server);
      if (betusers.length === 0) throw new Error('Không ai tham gia cược');
      const event_bet =
        await this.userService.handleGetEventModel('e-ti-le-bet');
      let precent = event_bet?.status ? event_bet?.value : 1.9;
      let newBetUser = [];
      for (const bet of betusers) {
        if (bet.result === result) {
          bet.receive = bet.amount * precent;
        }
        await this.handleUpdateUserBet(bet.id, bet.uid, betId, {
          resultBet: result,
          receive: bet.receive,
          isEnd: true,
        });
        bet.resultBet = result;
        newBetUser.push(bet);
      }
      const userNoti = newBetUser.filter(
        (bet) => bet.receive >= ConfigNoti.min * precent,
      );
      for (const bet of userNoti) {
        const user = await this.userService.findById(bet.uid);
        this.socketGateway.server.emit(
          'noti-bet',
          `Chúc mừng người chơi ${user.username} đã trúng lớn ${bet.receive} gold khi cược Boss xuất hiện ở núi khỉ ${result === '0' ? 'đỏ' : 'đen'}`,
        );
      }
      const msg = this.handleMessageResult({
        message: `result-bet-user-${server}`,
        status: true,
        data: newBetUser,
      });
      this.socketGateway.server.emit('re-bet-user-res-boss', msg);
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

  //TODO ———————————————[Handle Status Boss]———————————————
  @OnEvent('status-boss')
  async handleStatusBoss(data: StatusBoss) {
    const parameter = data.server; // Value will be lock

    // Create mutex if it not exist
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

      // Check Type spam or die of the boss
      const old_bet_boss = await this.betLogService.findByServer(server);
      const old_bet_sv = await this.betLogService.findSvByServer(
        `${server}-mini`,
      );
      if (new_content.includes('Núi khỉ đỏ')) {
        data['type'] = 0;
      } else if (new_content.includes('Núi khỉ đen')) {
        data['type'] = 1;
      } else {
        data['type'] = 2;
      }

      // Set new time respam for the boss if it has die
      data['respam'] = data['type'] === 2 ? 180 : 0;

      // Update database main boss
      const statusBoss = await this.bossService.createAndUpdate(server, {
        server,
        type: data?.type,
        respam: data?.respam,
      });

      // Get value now update
      const now = new Date();
      const current_now = new Date(statusBoss?.updatedAt);
      let hours = current_now.getHours();
      let minutes = current_now.getMinutes();
      const result = this.handleResultBetBoss(
        `${hours > 9 ? hours : `0${hours}`}${minutes > 9 ? minutes : `0${minutes}`}`,
      );

      let bet_data = {};

      // let return result to user
      if (data['type'] === 2) {
        if (old_bet_sv || old_bet_boss) {
          const update_old_boss = this.betLogService.update(old_bet_boss?.id, {
            server,
            timeEnd: this.addSeconds(now, 180),
            isEnd: false,
            result: ``,
          });
          const update_old_sv = this.betLogService.updateSv(old_bet_sv?.id, {
            server: `${server}-mini`,
            timeEnd: this.addSeconds(now, 180),
            isEnd: false,
            result: ``,
          });
          const [res1, res2] = await Promise.all([
            update_old_sv,
            update_old_boss,
          ]);
          bet_data['boss'] = res2;
          bet_data['sv'] = res1;
          bet_data['type'] = 'old';
        } else {
          // Create new Bet between Map Boss and Server
          const create_new_boss = this.betLogService.create({
            server,
            timeEnd: this.addSeconds(now, 180),
          });
          const create_new_sv = this.betLogService.createSv({
            server: `${server}-mini`,
            timeEnd: this.addSeconds(now, 180),
          });
          const [res1, res2] = await Promise.all([
            create_new_boss,
            create_new_sv,
          ]);
          bet_data['boss'] = res1;
          bet_data['sv'] = res2;
          bet_data['type'] = 'new';
        }
      } else {
        if (old_bet_sv || old_bet_boss) {
          // Send Result for user bet the map boss
          const resultUserMapBoss = this.handleResultBet({
            betId: old_bet_boss?.id,
            result: `${data['type']}`,
            server: server,
          });
          // Send result for user bet the sv
          const resultUserMapSv = this.handleResultServerWithBoss({
            betId: old_bet_sv?.id,
            result: result,
            server: `${server}-mini`,
          });
          await Promise.all([resultUserMapBoss, resultUserMapSv]);
          // Get two update old of MapBoss and Sv
          const update_old_boss = this.betLogService.findById(old_bet_boss?.id);
          const update_old_sv = this.betLogService.findSvById(old_bet_sv?.id);

          // Promise get two Database MapBossBet and SvBet
          const [res_update_old_sv, res_update_old_boss] = await Promise.all([
            update_old_sv,
            update_old_boss,
          ]);

          // Map Boss Update
          const reqUpdateMapBoss = this.betLogService.update(old_bet_boss?.id, {
            isEnd: true,
            result: `${data['type']}`,
            total: res_update_old_boss?.sendIn - res_update_old_boss?.sendOut,
          });
          const reqUpdateBetHistoryMapBoss =
            this.betLogService.createAndUpdateBetHistory(data?.server, {
              $inc: {
                sendIn: +res_update_old_boss?.sendIn,
                sendOut: +res_update_old_boss?.sendOut,
              },
            });
          // The sv update
          const reqUpdateSv = this.betLogService.updateSv(
            res_update_old_sv?.id,
            {
              isEnd: true,
              result: result,
              total: res_update_old_sv?.sendIn - res_update_old_sv?.sendOut,
            },
          );
          const reqUpdateBetHistorySv =
            this.betLogService.createAndUpdateBetHistory(
              `${data?.server}-mini`,
              {
                $inc: {
                  sendIn: +res_update_old_sv?.sendIn,
                  sendOut: +res_update_old_sv?.sendOut,
                },
              },
            );
          // Send all the Promise update
          const [resBoss1, resBoss2, resSv1, resSv2] = await Promise.all([
            reqUpdateMapBoss,
            reqUpdateBetHistoryMapBoss,
            reqUpdateSv,
            reqUpdateBetHistorySv,
          ]);
          bet_data['boss'] = resBoss1;
          bet_data['sv'] = resSv1;
          bet_data['type'] = 'old';
        }
      }
      this.logger.log(`Boss Status: ${data.content} - Server: ${data?.server}`);
      this.socketGateway.server.emit('status-boss', {
        type: bet_data['type'],
        boss: bet_data['boss'],
        server: server,
      });
      this.socketGateway.server.emit('status-sv', {
        type: bet_data['type'],
        sv: bet_data['sv'],
        server: `${server}-mini`,
      });
      return;
    } catch (err) {
      this.logger.log(`Boss Status: ${err.message} - Server: ${data?.server}`);
    } finally {
      release();
    }
  }
  //TODO ———————————————[Handler Mini game map boss]———————————————

  async handleUpdateUserBet(id: any, uid: any, betId: any, data: any) {
    const target = await this.userService.findById(uid);
    let clansObj = JSON.parse(target?.clan);
    // Check user has in the clan
    if ('clanId' in clansObj) {
      await this.userService.updateTotalBetClans(
        data?.receive,
        clansObj?.clanId,
      );
    }
    await this.userService.updateBet(id, data);
    if (data?.receive > 0) {
      await this.handleTransactionUserBet(uid, betId, data?.receive);
    }
  }

  async handleTransactionUserBet(id: any, betId: any, amount: number) {
    await this.userService.update(id, {
      $inc: {
        gold: +amount,
        totalBet: +amount,
      },
    });
    await this.betLogService.update(betId, {
      $inc: {
        sendOut: +amount,
      },
    });
  }

  //TODO ———————————————[Handler Mini Game Server (1,2,3) and 24/24]———————————————
  async handleResultServerWithBoss(data: ResultBetBoss) {
    try {
      let result = data.result;
      // Config receive
      const event_bet =
        await this.userService.handleGetEventModel('e-ti-le-bet');
      let precent = event_bet?.status ? event_bet?.value : 1.9;

      // Find all bet of sesson
      const all_bet = await this.userService.findBetWithBetId(
        data?.betId,
        `${data?.server}`,
      );
      let newBetUser = [];
      for (const bet of all_bet) {
        if (result.includes(bet.result)) {
          bet.receive = bet.amount * precent;
        }
        await this.handleUpdateUserBetWithBoss(bet.id, bet.uid, data?.betId, {
          resultBet: `${result}`,
          receive: bet.receive,
          isEnd: true,
        });
        bet.resultBet = result;
        newBetUser.push(bet);
      }
      const userNoti = newBetUser.filter(
        (bet) => bet.receive >= ConfigNoti.min * precent,
      );
      for (const bet of userNoti) {
        const user = await this.userService.findById(bet.uid);
        this.socketGateway.server.emit(
          'noti-bet',
          `Chúc mừng người chơi ${user.username} đã trúng lớn ${bet.receive} gold khi cược ${
            bet.result === 'C'
              ? 'Chẵn'
              : bet.result === 'CT'
                ? 'Chẵn và Tài'
                : bet.result === 'CX'
                  ? 'Chẵn và Xĩu'
                  : bet.result === 'L'
                    ? 'Lẽ'
                    : bet.result === 'LT'
                      ? 'Lẽ và Tài'
                      : bet.result === 'LX'
                        ? 'Lẽ và Xĩu'
                        : bet.result === 'T'
                          ? 'Tài'
                          : bet.result === 'X'
                            ? 'Xĩu'
                            : bet.result
          }`,
        );
      }
      const msg = this.handleMessageResult({
        message: `result-bet-boss-user-${data?.server}`,
        status: true,
        data: newBetUser,
      });
      this.socketGateway.server.emit('re-bet-user-res-sv', msg);
      return msg;
    } catch (err) {
      this.logger.log(
        `Bet Server Status: ${err.message} - Server: ${data?.server}`,
      );
      const msg = this.handleMessageResult({
        message: err.message,
        status: false,
        data: '',
      });
      return msg;
    }
  }

  randomResultWithTime(timeBoss: string): string {
    let result: string | Array<any | number>;
    let random = Math.floor(100000 + Math.random() * 900000);
    result = `${timeBoss}${random}`.split('').map((a) => Number(a));
    let new_result = result.reduce((a, b) => a + b, 0);
    return `${new_result}`;
  }

  async handleUpdateUserBetWithBoss(id: any, uid: any, betId: any, data: any) {
    const target = await this.userService.findById(uid);
    let clansObj = JSON.parse(target?.clan);
    // Check user has in the clan
    if ('clanId' in clansObj) {
      await this.userService.updateTotalBetClans(
        data?.receive,
        clansObj?.clanId,
      );
    }
    await this.userService.updateBet(id, data);
    if (data?.receive > 0) {
      await this.handleTransactionUserBetWithBoss(uid, betId, data?.receive);
    }
  }

  async handleTransactionUserBetWithBoss(id: any, betId: any, amount: number) {
    await this.userService.update(id, {
      $inc: {
        gold: +amount,
        totalBet: +amount,
      },
    });
    await this.betLogService.updateSv(betId, {
      $inc: {
        sendOut: +amount,
      },
    });
  }

  handleResultBetBoss(timeBoss: string) {
    let result = this.randomResultWithTime(`${timeBoss}`);
    let new_result = `${result}`.split('')[1];
    let obj_result = {
      c: Number(new_result) % 2 === 0,
      l: Number(new_result) % 2 !== 0,
      x: Number(new_result) < 5,
      t: Number(new_result) > 4,
      total: {
        CL: '',
        TX: '',
        result: `${result}`,
        XIEN: '',
      },
    };
    obj_result.total.CL = `${obj_result.c ? 'C' : 'L'}`;
    obj_result.total.TX = `${obj_result.t ? 'T' : 'X'}`;
    obj_result.total.XIEN = `${obj_result.total.CL}${obj_result.total.TX}`;
    return `${obj_result.total.XIEN}-${obj_result.total.result}`;
  }

  //TODO ———————————————[Handler Mini game Server 24/24]———————————————
  @OnEvent('server-24')
  async handleServerAuto() {
    try {
      // Let config
      const now = new Date();
      // Let find the old bet
      let old_bet = await this.betLogService.findSvByServer('24');

      // Update database main boss
      await this.bossService.createAndUpdate('24', {
        server: '24',
        type: 4,
        respam: 60,
      });

      // Get value now update
      let hours = now.getHours();
      let minutes = now.getMinutes();
      const result = this.handleResultBetBoss(
        `${hours > 9 ? hours : `0${hours}`}${minutes > 9 ? minutes : `0${minutes}`}`,
      );

      let new_bet = null;
      // If the bet not exist > will create new
      if (!old_bet) {
        await this.betLogService.createSv({
          server: '24',
          timeEnd: this.addSeconds(now, 60),
        });
      } else {
        // Check if the result is jack pot
        if (result.includes('99')) {
          await this.handleJackPotServerAuto({
            betId: old_bet?.id,
            result: result,
            server: `24`,
          });
        }

        // Send result for user bet the sv
        await this.handleResultServerWithBoss({
          betId: old_bet?.id,
          result: result,
          server: `24`,
        });

        const update_old_sv = await this.betLogService.findSvById(old_bet?.id);
        const reqUpdateSv = this.betLogService.updateSv(update_old_sv?.id, {
          isEnd: true,
          result: result,
          total: update_old_sv?.sendIn - update_old_sv?.sendOut,
        });
        const reqUpdateBetHistorySv =
          this.betLogService.createAndUpdateBetHistory(`24`, {
            $inc: {
              sendIn: +update_old_sv?.sendIn,
              sendOut: +update_old_sv?.sendOut,
            },
          });
        const [res_old_bet, res_olb_bet_history] = await Promise.all([
          reqUpdateSv,
          reqUpdateBetHistorySv,
        ]);
        old_bet = res_old_bet;
        // Create new bet
        new_bet = await this.betLogService.createSv({
          server: '24',
          timeEnd: this.addSeconds(now, 60),
        });
      }

      const msg = this.handleMessageResult({
        message: 'server-24-is-run',
        status: true,
        data: '',
      });
      this.logger.log(
        `Server 24/24: Result is ${result} - Update/Create: ${old_bet ? true : false}`,
      );
      this.socketGateway.server.emit('status-24/24', {
        old_bet: old_bet,
        result,
        server: '24',
        new_bet: new_bet,
      });
      return msg;
    } catch (err) {
      const msg = this.handleMessageResult({
        message: err.message,
        status: false,
        data: '',
      });
      return msg;
    }
  }

  async handleJackPotServerAuto(data: ResultBetBoss) {
    try {
      const { betId, result, server } = data;

      // Let find all User is bet
      const all_bets = await this.userService.findBetWithBetId(betId, server);
      const historyBet =
        await this.betLogService.findBetHistoryByServer(server);

      let list_user_amount: Record<string, number> = {};
      let list_user_isWin: Record<string, boolean> = {};
      for (const bet of all_bets) {
        list_user_amount[bet.uid] = list_user_amount[bet?.id]
          ? list_user_amount[bet.id] + bet.amount
          : bet.amount;
        if (result.includes(bet.result)) {
          list_user_isWin[bet.uid] = true;
        }
      }
      let list_user_jackpot: Array<any> = [];
      // Filter user is win in the list_user_amount and the list user iswin
      for (const key of Object.keys(list_user_isWin)) {
        list_user_jackpot.push({ uid: key, amount: list_user_amount[key] });
      }
      // Let sum total amount of user is win
      let totalSumWin = list_user_jackpot.reduce((a, b) => a + b.amount, 0);
      // Let calculator percent the user will get how much percent of the prize
      let list_user_percent = [];
      for (const user of list_user_jackpot) {
        list_user_percent.push({
          uid: user.uid,
          percent: Math.floor(user.amount / totalSumWin),
          amount: user.amount,
        });
      }

      // let render show the prize of user
      let list_user_prize = list_user_percent.map((user) => {
        let prize = historyBet.jackpot * user.percent;
        return { ...user, prize };
      });

      // let send the prize for user and update the prize on history bet
      for (const user of list_user_prize) {
        await this.userService.update(user.uid, {
          $inc: {
            gold: +user.prize,
          },
        });
        this.socketGateway.server.emit(
          'noti-bet',
          `Chúc mừng người chơi có ID: ${this.shortenString(user.uid, 3, 3)} đã trúng jackpot ${user.prize} gold`,
        );
      }

      let totalPrize = list_user_prize.reduce((a, b) => a + b.prize, 0);
      await this.betLogService.createAndUpdateBetHistory(server, {
        $inc: {
          jackpot: -totalPrize,
        },
      });

      return;
    } catch (err) {
      return err.message;
    }
  }

  //TODO ———————————————[Handle System Clans]———————————————
  @OnEvent('rank-clans')
  async handleRankClans() {
    try {
      // Let find top 10 rank clans with totalBet
      const topClans = await this.userService.getTopClans();

      // Let find list user in the top clans
      let list_clans_users: Record<string, Array<any>> = {};
      for (const clan of topClans) {
        const { id } = clan;
        const users = await this.userService.getUserWithClansId(id);
        list_clans_users[id] = users;
      }
      console.log(list_clans_users);
    } catch (err) {
      return err.message;
    }
  }

  @OnEvent('rank-days')
  async handleRankDays() {
    try {
      const topUser = await this.userService.getTopUserBet();
      for (const user of topUser) {
        console.log(user);
      }
    } catch (err) {
      return err.message;
    }
  }

  //TODO ———————————————[Handler Another]———————————————

  addSeconds(date: Date, seconds: number): Date {
    return new Date(date.getTime() + seconds * 1000);
  }

  async queryRequestUserBet(
    uid: any,
    betId: any,
    server: string,
    amount: number,
    result: string,
  ) {
    // Find User with UID
    const target = await this.userService.findById(uid);
    if (!target) throw new Error('Người chơi không tồn tại');

    // Check Sv Default of user ...
    let min_amount = ConfigBet.min;
    let max_amount = ['24', server].includes(target?.server)
      ? ConfigBet.max
      : ConfigBetDiff.max;
    let total_amount = ['24', server].includes(target?.server)
      ? ConfigBet.total
      : ConfigBetDiff.total;
    if (target.gold - amount <= 0)
      throw new Error('Tài khoản của bản không khả dụng');

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
    if (!this.isValidBet(result, old_bet_user))
      throw new Error('Bạn không được phép đặt 2 cầu');

    // console.log(total_bet_user, min_amount, max_amount, amount);
    if (total_bet_user + amount > total_amount)
      throw new Error('Đã vượt quá giới hạn số lượng cược cho phép');

    // Check min limited bet amount
    if (amount < min_amount)
      throw new Error(`Số lượng cược nhỏ nhất là ${ConfigBet.min} gold`);

    // Check max limited bet amount
    if (amount > max_amount)
      throw new Error(`Số lượng cược lớn nhất là ${max_amount}`);
    return target;
  }

  shortenString(str, startLength, endLength) {
    if (str.length <= startLength + endLength) {
      return str; // Trả về chuỗi gốc nếu nó ngắn hơn hoặc bằng tổng chiều dài của phần đầu và phần cuối
    }

    const start = str.substring(0, startLength);
    const end = str.substring(str.length - endLength, str.length);
    return `${start}...${end}`;
  }

  // Hàm kiểm tra cược Chẵn Lẻ - Tài Xỉu có hợp lệ không
  isValidBet(newBet: string, oldBets: UserBet[]): boolean {
    // Tách cược mới thành các phần
    const newBetParts = newBet.split('');

    for (const bet of oldBets) {
      // Tách cược cũ thành các phần
      const oldBetParts = bet.result.split('');

      // Kiểm tra từng phần của cược mới với từng phần của cược cũ
      for (const oldPart of oldBetParts) {
        for (const newPart of newBetParts) {
          if (
            (oldPart === 'C' && newPart === 'L') ||
            (oldPart === 'L' && newPart === 'C') ||
            (oldPart === 'T' && newPart === 'X') ||
            (oldPart === 'X' && newPart === 'T') ||
            (oldPart === '1' && newPart === '0') ||
            (oldPart === '0' && newPart === '1')
          ) {
            return false;
          }
        }
      }
    }

    return true;
  }
}
