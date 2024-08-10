import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BetLogService } from 'src/bet-log/bet-log.service';
import { BossService } from 'src/boss/boss.service';
import { BotService } from 'src/bot/bot.service';
import { CronjobService } from 'src/cronjob/cronjob.service';
import { SessionService } from 'src/session/session.service';
import {
  CreateUserBet,
  DelUserBet,
  MessagesChat,
  ResultDataBet,
  ValueBetUserSv,
} from 'src/socket/dto/socket.dto';
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
import * as moment from 'moment';
import { MessegesService } from 'src/messeges/messeges.service';
import { CatchException } from 'src/common/common.exception';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventRandom } from './schema/eventRandom';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from 'src/auth/constants';
import seedrandom from 'seedrandom';
import { CreateUserActive } from 'src/user/dto/user.dto';

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
    private readonly messageService: MessegesService,
    private eventEmitter: EventEmitter2,
    @InjectModel(EventRandom.name)
    private readonly eventRandomDrawModel: Model<EventRandom>,
    private jwtService: JwtService,
  ) {}

  private readonly mutexMap = new Map<string, Mutex>();
  private logger: Logger = new Logger('Events');

  //TODO ———————————————[Handle Create Bet User]———————————————

  @OnEvent('bet-user-ce-boss')
  async handleBetUser(data: CreateUserBet) {
    const parameter = `${data.uid}-bet-user-ce-boss`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    const { uid, amount, betId, result, server } = data;
    try {
      // Time lock
      // let lock = moment().hours();
      // if (lock >= 20) throw new Error('Thời gian hoạt động đã kết thúc');
      // Let check timeEnd
      const e_auto_bet_boss =
        await this.userService.handleGetEventModel('e-auto-bet-boss');
      if (!e_auto_bet_boss.status && uid !== '66a93f03c73cf0838db43e9a')
        throw new Error('Hệ thống Cược Server Map Boss đang bảo trì');

      const bet_session = await this.betLogService.findById(betId);
      if (!bet_session || bet_session.isEnd)
        throw new Error('Ván cược đã kết thúc');

      if (result.length < 1) throw new Error('Xin vui lòng Dự Đoán Kết Quả');

      let current_now = Math.floor(Date.now() / 1000);
      let timeEnd = Math.floor(new Date(bet_session.timeEnd).getTime() / 1000);
      if (timeEnd - current_now < 12)
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
          gold: -Number(amount),
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
        name: target.name,
      });

      await this.userService.handleCreateUserActive({
        uid: target.id,
        active: JSON.stringify({
          name: 'Cược',
          server: server,
          result: result,
          amount: amount,
          userBetId: betCreate.id,
        }),
        currentGold: target.gold,
        newGold: target.gold - Number(amount),
      });
      let new_resultUser = JSON.parse(bet_session.resultUser ?? '{}');
      new_resultUser[`${result}`] = (new_resultUser[`${result}`] ?? 0) + amount;
      // Let update sendIn The bet
      const e_mainBet = await this.betLogService.update(betId, {
        $inc: {
          sendIn: +amount,
        },
        resultUser: JSON.stringify(new_resultUser),
      });
      const msg = this.handleMessageResult({
        message: 'Tham gia cược thành công',
        status: true,
        data: [betCreate],
        server: data?.server,
      });
      this.socketGateway.server.emit('re-bet-user-ce-boss', msg);
      if (amount >= ConfigNoti.min) {
        await this.handleMessageSystem(
          `Người chơi ${target.name} đang chơi lớn ${amount} thỏi vàng vào núi khỉ ${result === '0' ? 'đỏ' : 'đen'}`,
          data?.server,
        );
      }

      this.socketGateway.server.emit('value-bet-user-re', {
        status: true,
        data: { result, amount, server, betId },
      });
      this.socketGateway.server.emit('mainBet-up', e_mainBet);
      return msg;
    } catch (err) {
      const msg = this.handleMessageResult({
        message: err.message,
        status: false,
        data: [data],
      });
      this.socketGateway.server.emit('re-bet-user-ce-boss', msg);
      // throw new CatchException(err);
    } finally {
      release();
    }
  }

  @OnEvent('bet-user-ce-sv')
  async handleBetSvAuto(data: CreateUserBet) {
    const parameter = `${data.uid}-bet-user-ce-sv`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    const { amount, betId, result, server, uid } = data;
    try {
      // Time lock
      // let lock = moment().hours();
      // if (lock >= 20 && server !== '24')
      //   throw new Error('Thời gian hoạt động đã kết thúc');
      // Let check timeEnd
      const e_auto_bet_sv =
        await this.userService.handleGetEventModel('e-auto-bet-sv');
      if (!e_auto_bet_sv.status && uid !== '66a93f03c73cf0838db43e9a')
        throw new Error('Hệ thống Cược Server 1,2,3,24 đang bảo trì');

      const bet_session = await this.betLogService.findSvById(betId);
      if (!bet_session || bet_session.isEnd)
        throw new Error('Ván cược đã kết thúc');

      if (result.length < 1) throw new Error('Xin vui lòng Dự Đoán Kết Quả');

      let current_now = moment().unix();
      let timeEnd = moment(bet_session.timeEnd).unix();
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
          gold: -Number(amount),
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
        name: target.name,
      });

      await this.userService.handleCreateUserActive({
        uid: target.id,
        active: JSON.stringify({
          name: 'Cược',
          server: server,
          result: result,
          amount: amount,
          userBetId: betCreate.id,
        }),
        currentGold: target.gold,
        newGold: target.gold - Number(amount),
      });
      let new_resultUser = JSON.parse(bet_session.resultUser ?? '{}');
      if ('CTCXLTLX'.indexOf(result) > -1) {
        this.socketGateway.server.emit('value-bet-user-re', {
          status: true,
          data: { result, amount, server, betId },
        });
        let res = result.toLowerCase();
        // XIEN
        if (result.length === 2) {
          for (const str of res) {
            new_resultUser[str] = (new_resultUser[str] ?? 0) + amount / 2;
          }
        } else {
          // CLTX
          new_resultUser[res] = (new_resultUser[res] ?? 0) + amount;
        }
      }
      // Let update sendIn The bet
      const e_mainBet = await this.betLogService.updateSv(betId, {
        $inc: {
          sendIn: +amount,
        },
        resultUser: JSON.stringify(new_resultUser),
      });

      this.socketGateway.server.emit('');

      // Update jackpot if it is the server 24/24
      if (bet_session.server === '24') {
        const historyServer =
          await this.betLogService.createAndUpdateBetHistory(
            bet_session.server,
            {
              $inc: {
                jackpot: +amount * 0.1,
              },
            },
          );
        this.socketGateway.server.emit('jackpot-up', historyServer);
      }
      const msg = this.handleMessageResult({
        message: 'Tham gia cược thành công',
        status: true,
        data: [betCreate],
        server: server,
      });
      this.socketGateway.server.emit('re-bet-user-ce-sv', msg);
      this.socketGateway.server.emit('mainBet-up', e_mainBet);
      if (amount >= ConfigNoti.min) {
        await this.handleMessageSystem(
          `Người chơi ${target.name} đang chơi lớn ${amount} thỏi vàng vào ${
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
          server,
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
      // throw new CatchException(err);
    } finally {
      release();
    }
  }

  @OnEvent('value-bet-users')
  async valueBetUserSv(data: ValueBetUserSv) {
    const parameter = `${data.server}-value-bet-users`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const target = await this.userService.findBetWithBetId(
        data?.betId,
        data?.server,
      );
      let result_bet = {
        t: 0,
        x: 0,
        c: 0,
        l: 0,
        0: 0,
        1: 0,
      };
      for (const bet of target) {
        const { result, amount } = bet;
        if ('CTCXLTLX'.indexOf(result) > -1) {
          let split_res = result.toLowerCase().split('');
          if (split_res.length > 1) {
            result_bet[split_res[0]] = amount / 2;
            result_bet[split_res[1]] = amount / 2;
          } else {
            result_bet[split_res[0]] = amount;
          }
        } else if (
          ['1', '2', '3'].includes(data?.server) &&
          '01'.indexOf(result) > -1
        ) {
          result_bet[result] = amount;
        }
      }
      const msg = this.handleMessageResult({
        message: 'Get Value User Success',
        status: true,
        data: { result: result_bet, data: data?.server },
      });
      this.socketGateway.server.emit('value-bet-users-re', msg);
    } catch (err) {
      const msg = this.handleMessageResult({
        message: err.message,
        status: false,
        data: null,
      });
      this.socketGateway.server.emit('value-bet-users-re', msg);
    } finally {
      release();
    }
  }

  //TODO ———————————————[Handler Del Bet User]———————————————
  @OnEvent('bet-user-del-boss')
  async handleDelBetUserBoss(data: DelUserBet) {
    const parameter = `${data.uid}-bet-user-del-boss`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const { betId, uid, userBetId } = data;
      const targetUserBetLog = await this.userService.findByIdBet(userBetId);
      const { amount } = targetUserBetLog;
      const targetBetId = await this.betLogService.findById(betId);
      const { timeEnd } = targetBetId;
      let now = moment(new Date()).unix();
      let currentEnd = moment(timeEnd).unix();
      if (currentEnd - now < 5)
        throw new Error('Không thể hủy cược vào lúc này');

      // Update BetLog Chung
      await this.betLogService.update(betId, {
        $inc: {
          sendIn: -amount,
        },
      });

      // Update server data
      const targetUser = await this.userService.findById(uid);
      await this.userService.handleCreateUserActive({
        uid: uid,
        active: JSON.stringify({
          name: 'Hủy Cược',
          server: targetUserBetLog.server,
          result: targetUserBetLog.result,
          userBetId: userBetId,
        }),
        currentGold: targetUser.gold,
        newGold: targetUser.gold + amount,
      });
      const user = await this.userService.update(uid, {
        $inc: {
          gold: +amount,
        },
      });
      const { pwd_h, ...res } = user.toObject();
      // Delete UserBet
      await this.userService.deletOneUserBetWithID(userBetId);
      const msg = this.handleMessageResult({
        message: 'Đã hủy cược thành công',
        status: true,
        data: {
          user: res,
          userBetId,
        },
        server: targetBetId.server,
      });
      this.socketGateway.server.emit('bet-user-del-boss-re', msg);
      return msg;
    } catch (err) {
      const msg = this.handleMessageResult({
        message: err.message,
        status: false,
        data: data,
      });
      this.socketGateway.server.emit('bet-user-del-boss-re', msg);
      // throw new CatchException(err);
    } finally {
      release();
    }
  }

  @OnEvent('bet-user-del-sv')
  async handleDelBetUserSv(data: DelUserBet) {
    const parameter = `${data.uid}-bet-user-del-sv`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const { betId, uid, userBetId } = data;
      const targetUserBetLog = await this.userService.findByIdBet(userBetId);
      const { amount } = targetUserBetLog;
      const targetBetId = await this.betLogService.findSvById(betId);
      const { timeEnd } = targetBetId;
      let now = moment(new Date()).unix();
      let currentEnd = moment(timeEnd).unix();
      if (currentEnd - now < 5)
        throw new Error('Không thể hủy cược vào lúc này');

      // Update BetLog Chung
      await this.betLogService.updateSv(betId, {
        $inc: {
          sendIn: -amount,
        },
      });

      // Update server data
      const targetUser = await this.userService.findById(uid);
      await this.userService.handleCreateUserActive({
        uid: uid,
        active: JSON.stringify({
          name: 'Hủy Cược',
          server: targetUserBetLog.server,
          result: targetUserBetLog.result,
          userBetId: userBetId,
        }),
        currentGold: targetUser.gold,
        newGold: targetUser.gold + amount,
      });
      const user = await this.userService.update(uid, {
        $inc: {
          gold: +amount,
        },
      });
      const { pwd_h, ...res } = user.toObject();
      // Delete UserBet
      await this.userService.deletOneUserBetWithID(userBetId);
      const msg = this.handleMessageResult({
        message: 'Đã hủy cược thành công',
        status: true,
        data: {
          user: res,
          userBetId,
        },
        server: targetBetId.server,
      });
      this.socketGateway.server.emit('bet-user-del-sv-re', msg);
      return msg;
    } catch (err) {
      const msg = this.handleMessageResult({
        message: err.message,
        status: false,
        data: data,
      });
      this.socketGateway.server.emit('bet-user-del-sv-re', msg);
      // throw new CatchException(err);
    } finally {
      release();
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
          server: bet.server,
          result: bet.result,
          amount: bet.amount,
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
        await this.handleMessageSystem(
          `Chúc mừng những người chơi ${user.name} đã trúng lớn ${bet.receive} gold khi cược Boss xuất hiện ở núi khỉ ${result === '0' ? 'đỏ' : 'đen'}`,
          server,
        );
      }
      const msg = this.handleMessageResult({
        message: `result-bet-user-${server}`,
        status: true,
        data: newBetUser,
        server: server,
      });
      this.socketGateway.server.emit('re-bet-user-res-boss', msg);
      return msg;
    } catch (err) {
      const msg = this.handleMessageResult({
        message: err.message,
        status: false,
        data: [],
      });
      // throw new CatchException(err);
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
    const parameter = `${data.server}-status-boss-server`; // Value will be lock

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
        let now = moment().unix();
        let current_update = moment(old_server_update.updatedAt).unix();
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
      let current = new Date(statusBoss?.updatedAt);
      let hours = current.getHours();
      let minutes = current.getMinutes();
      const result_target = await this.eventRandomDrawModel.findOne({
        betId: old_bet_sv?.id,
        isEnd: false,
      });
      // const result = this.handleResultBetBoss(
      //   result_target?.timeBoss ??
      //     `${hours > 9 ? hours : `0${hours}`}${minutes > 9 ? minutes : `0${minutes}`}`,
      //   result_target?.value ??
      //     `${Math.floor(100000 + Math.random() * 900000)}`,
      // );

      const result = this.handleResultBet24(
        result_target?.value ??
          `${Math.floor(Math.random() * (99 - 0 + 1)) + 0}`,
      );

      let bet_data = {};

      // let return result to user
      if (data['type'] === 2) {
        if (old_bet_sv || old_bet_boss) {
          const update_old_boss = this.betLogService.update(old_bet_boss?.id, {
            server,
            timeEnd: this.addSeconds(current, 180),
            isEnd: false,
            result: ``,
          });
          const update_old_sv = this.betLogService.updateSv(old_bet_sv?.id, {
            server: `${server}-mini`,
            timeEnd: this.addSeconds(current, 180),
            isEnd: false,
            result: ``,
            timeBoss: `${hours > 9 ? hours : `0${hours}`}${minutes > 9 ? minutes : `0${minutes}`}`,
          });
          const [res1, res2] = await Promise.all([
            update_old_sv,
            update_old_boss,
          ]);
          await this.eventRandomDrawModel.findOneAndUpdate(
            {
              betId: old_bet_sv?.id,
              isEnd: false,
            },
            {
              timeBoss: `${hours > 9 ? hours : `0${hours}`}${minutes > 9 ? minutes : `0${minutes}`}`,
            },
            { upsert: true, new: true },
          );

          bet_data['boss'] = res2;
          bet_data['sv'] = res1;
          bet_data['type'] = 'old';
          bet_data['timeBoss'] =
            `${hours > 9 ? hours : `0${hours}`}${minutes > 9 ? minutes : `0${minutes}`}`;
        } else {
          // Create new Bet between Map Boss and Server
          const create_new_boss = this.betLogService.create({
            server,
            timeEnd: this.addSeconds(current, 180),
            resultUser: JSON.stringify({
              1: 0,
              0: 0,
            }),
          });
          const create_new_sv = this.betLogService.createSv({
            server: `${server}-mini`,
            timeEnd: this.addSeconds(current, 180),
            timeBoss: `${hours > 9 ? hours : `0${hours}`}${minutes > 9 ? minutes : `0${minutes}`}`,
            resultUser: JSON.stringify({
              t: 0,
              l: 0,
              c: 0,
              x: 0,
            }),
          });
          const [res1, res2] = await Promise.all([
            create_new_boss,
            create_new_sv,
          ]);
          const result_new_sv = Math.floor(Math.random() * (99 - 0 + 1)) + 0;
          await this.eventRandomDrawModel.create({
            betId: res2.id,
            isEnd: false,
            value: result_new_sv,
            timeBoss: `${hours > 9 ? hours : `0${hours}`}${minutes > 9 ? minutes : `0${minutes}`}`,
          });
          bet_data['boss'] = res1;
          bet_data['sv'] = res2;
          bet_data['type'] = 'new';
          bet_data['timeBoss'] =
            `${hours > 9 ? hours : `0${hours}`}${minutes > 9 ? minutes : `0${minutes}`}`;
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
      this.handleMessageSystem(data.content, data?.server);
      this.socketGateway.server.emit('status-boss', {
        type: bet_data['type'],
        boss: bet_data['boss'],
        server: server,
      });
      this.socketGateway.server.emit('status-sv', {
        type: bet_data['type'],
        sv: bet_data['sv'],
        server: `${server}-mini`,
        timeBoss: bet_data['timeBoss'] ?? null,
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
      await this.handleTransactionUserBet(uid, betId, data, id);
    }
  }

  async handleTransactionUserBet(
    id: any,
    betId: any,
    data: any,
    userBetId: any,
  ) {
    // Update server data
    const targetUser = await this.userService.findById(id);
    await this.userService.handleCreateUserActive({
      uid: id,
      active: JSON.stringify({
        name: 'Thanh toán Cược',
        server: data?.server,
        result: data?.result,
        resultBet: data?.resultBet,
        amount: data?.amount,
        receive: data?.receive,
        userBetId: userBetId,
      }),
      currentGold: targetUser.gold,
      newGold: targetUser.gold + Number(data?.receive),
    });
    await this.userService.update(id, {
      $inc: {
        gold: +Number(data?.receive),
        totalBet: +Number(data?.receive),
        limitedTrade: +Number(data?.receive),
      },
    });
    await this.betLogService.update(betId, {
      $inc: {
        sendOut: +Number(data?.receive),
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
      const e_xien =
        await this.userService.handleGetEventModel('e-percent-xien');
      const e_result =
        await this.userService.handleGetEventModel('e-percent-result');

      // Find all bet of sesson
      const all_bet = await this.userService.findBetWithBetId(
        data?.betId,
        `${data?.server}`,
      );
      let newBetUser = [];
      for (const bet of all_bet) {
        if (result.includes(bet.result)) {
          if ('CTCXLTLX'.indexOf(bet.result) > -1) {
            let split_res = bet.result.toLowerCase().split('');
            if (split_res.length > 1) {
              bet.receive = bet.amount * e_xien.value;
            } else {
              bet.receive = bet.amount * precent;
            }
          } else {
            bet.receive = bet.amount * e_result.value;
          }
        }
        await this.handleUpdateUserBetWithBoss(bet.id, bet.uid, data?.betId, {
          server: bet.server,
          result: bet.result,
          amount: bet.amount,
          resultBet: `${result}`,
          receive: bet.receive,
          isEnd: true,
        });
        bet.resultBet = result;
        newBetUser.push(bet);
      }
      await this.eventRandomDrawModel.findOneAndUpdate(
        { betId: data?.betId },
        { isEnd: true },
        { new: true, upsert: true },
      );
      const userNoti = newBetUser.filter(
        (bet) => bet.receive >= ConfigNoti.min * precent,
      );
      for (const bet of userNoti) {
        const user = await this.userService.findById(bet.uid);
        await this.handleMessageSystem(
          `Chúc mừng những người chơi ${user.name} đã trúng lớn ${bet.receive} gold khi cược ${
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
          data?.server,
        );
      }
      const msg = this.handleMessageResult({
        message: `result-bet-boss-user-${data?.server}`,
        status: true,
        data: newBetUser,
        server: data?.server,
      });
      let resultBet = result?.split('-');
      let new_resultBet =
        resultBet[0] in TranslateKey
          ? TranslateKey[`${resultBet[0]}`]
          : resultBet[0];
      let new_resultBet_concat = [new_resultBet, resultBet[1]].join('-');
      this.socketGateway.server.emit('re-bet-user-res-sv', msg);
      this.handleMessageSystem(
        `Server ${data?.server.replace('-mini', ' Sao')}: Chúc mừng những người chơi đã chọn ${new_resultBet_concat}`,
        data?.server,
      );
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
      // throw new CatchException(err);
    }
  }

  randomResultWithTime(timeBoss: string, random: string): string {
    let result: string | Array<any | number>;
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
      await this.handleTransactionUserBetWithBoss(uid, betId, data, id);
    }
  }

  async handleTransactionUserBetWithBoss(
    id: any,
    betId: any,
    data: any,
    userBetId: any,
  ) {
    // Update server data
    const targetUser = await this.userService.findById(id);
    await this.userService.handleCreateUserActive({
      uid: id,
      active: JSON.stringify({
        name: 'Thanh toán Cược',
        server: data?.server,
        result: data?.result,
        resultBet: data?.resultBet,
        amount: data?.amount,
        receive: data?.receive,
        userBetId: userBetId,
      }),
      currentGold: targetUser.gold,
      newGold: targetUser.gold + Number(data?.receive),
    });
    await this.userService.update(id, {
      $inc: {
        gold: +Number(data?.receive),
        totalBet: +Number(data?.receive),
        limitedTrade: +Number(data?.receive),
      },
    });
    await this.betLogService.updateSv(betId, {
      $inc: {
        sendOut: +Number(data?.receive),
      },
    });
  }

  handleResultBetBoss(timeBoss: string, random: string) {
    let result = this.randomResultWithTime(`${timeBoss}`, random);
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

  handleResultBet24(random: string) {
    let result = `${Number(random) > 9 ? random : `0${random}`}`;
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
      const result_target = await this.eventRandomDrawModel.findOne({
        betId: old_bet.id,
        isEnd: false,
      });
      const result = this.handleResultBet24(
        result_target?.value ??
          `${Math.floor(Math.random() * (98 - 0 + 1)) + 0}`,
      );

      let new_bet = null;
      // If the bet not exist > will create new
      if (!old_bet) {
        const res2 = await this.betLogService.createSv({
          server: '24',
          timeEnd: this.addSeconds(now, 60),
          resultUser: JSON.stringify({
            t: 0,
            l: 0,
            c: 0,
            x: 0,
          }),
        });
        const result_new_sv = Math.floor(Math.random() * (98 - 0 + 1)) + 0;
        await this.eventRandomDrawModel.create({
          betId: res2.id,
          isEnd: false,
          value: result_new_sv,
          timeBoss: `${hours > 9 ? hours : `0${hours}`}${minutes > 9 ? minutes : `0${minutes}`}`,
        });
      } else {
        // Check if the result is jack pot
        // if (result.includes('99')) {
        //   await this.handleJackPotServerAuto({
        //     betId: old_bet?.id,
        //     result: result,
        //     server: `24`,
        //   });
        // }

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
        const res2 = await this.betLogService.createSv({
          server: '24',
          timeEnd: this.addSeconds(now, 60),
        });
        const result_new_sv = Math.floor(Math.random() * (98 - 0 + 1)) + 0;
        await this.eventRandomDrawModel.create({
          betId: res2.id,
          isEnd: false,
          value: result_new_sv,
          timeBoss: `${Math.floor(1000 + Math.random() * 9000)}`,
        });
        new_bet = res2.toObject();
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
      // throw new CatchException(err);
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
        await this.handleMessageSystem(
          `Chúc mừng người chơi có ID: ${this.shortenString(user.uid, 3, 3)} đã trúng jackpot ${user.prize} gold`,
          server,
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
      // throw new CatchException(err);
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
      // throw new CatchException(err);
    }
  }

  @OnEvent('rank-days')
  async handleRankDays() {
    try {
      let e_auto_rank_days =
        await this.userService.handleGetEventModel('e-auto-rank-days');
      let e_rule_rank_days =
        await this.userService.handleGetEventModel('e-rule-rank-days');
      let arr = JSON.parse(e_auto_rank_days.option);
      let now = moment();
      const topUser = await this.userService.getTopUserBet();
      for (let i = 0; i < topUser.length; i++) {
        let user = topUser[i];
        let prize = 0;
        if (
          i < arr.length &&
          e_auto_rank_days.status &&
          user.totalBet > e_rule_rank_days.value
        ) {
          prize = arr[i];

          // Update server data
          await this.handleCreateUserActive({
            uid: user.id,
            // active: `Giải thưởng top rank days`,
            active: JSON.stringify({
              name: 'rank days',
              rank: i + 1,
              prize: prize,
            }),
            currentGold: user.gold,
            newGold: user.gold + prize,
          });
          await this.userService.handleUserPrizeCreate({
            amount: arr[i],
            rank: `${i + 1}`,
            type: 'rank-days',
            uid: user.id,
            username: user.username,
          });
        }

        // Check VIP is expired
        const targetVip = await this.userService.handleFindUserVip(user.id);
        if (targetVip && !targetVip.isEnd) {
          if (now.isAfter(moment(targetVip.timeEnd).endOf('day'))) {
            // Reset VIP User
            await this.userService.update(user.id, {
              vip: 0,
              totalBank: 0,
            });
            await this.userService.handleStopUserVip({
              isEnd: true,
              uid: user.id,
            });

            // Update server data
            await this.handleCreateUserActive({
              uid: user.id,
              active: JSON.stringify({
                name: 'Reset VIP',
                date: moment(),
              }),
              currentGold: user.gold,
              newGold: user.gold,
            });
          } else {
            //
            let new_data = JSON.parse(targetVip.data);
            let find_index_data_now = new_data?.findIndex(
              (d: any) => d.date === now.add(-1, 'day').format('DD/MM/YYYY'),
            );
            let find_isCancel = new_data?.reduce(
              (a: any, b: any) => a + (b?.isCancel ? 1 : 0),
              0,
            );
            if (find_isCancel >= 7) {
              // Reset VIP User
              await this.userService.update(user.id, {
                vip: 0,
                totalBank: 0,
              });
              await this.userService.handleStopUserVip({
                isEnd: true,
                uid: user.id,
              });

              // Update server data
              await this.handleCreateUserActive({
                uid: user.id,
                active: JSON.stringify({
                  name: 'Reset VIP',
                  date: moment(),
                }),
                currentGold: user.gold,
                newGold: user.gold,
              });
            } else {
              new_data[find_index_data_now] = {
                ...new_data[find_index_data_now],
                isNext: true,
                isCancel: user?.totalBet > 0 ? false : true,
              };
              await this.userService.handleUpdateUserVip(user.id, {
                data: JSON.stringify(new_data),
              });
            }
          }
        }

        // Update user totalBet and limited Trade
        await this.userService.update(user.id, {
          totalBet: 0,
          limitedTrade: 0,
          trade: 0,
          $inc: {
            gold: +prize,
          },
        });
      }
    } catch (err) {
      // throw new CatchException(err);
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

    //TODO ———————————————[Config Event BET]———————————————
    const e_min = await this.userService.handleGetEventModel('e-min-bet');
    const e_max_bet_main =
      await this.userService.handleGetEventModel('e-max-bet-main');
    const e_total_bet_main =
      await this.userService.handleGetEventModel('e-total-bet-main');
    const e_max_bet_server =
      await this.userService.handleGetEventModel('e-max-bet-server');
    const e_total_bet_server =
      await this.userService.handleGetEventModel('e-total-bet-server');

    // Check Sv Default of user ...
    let min_amount = e_min.value;
    let max_amount = ['24', server].includes(target?.server)
      ? e_max_bet_main.value
      : e_max_bet_server.value;
    let total_amount = ['24', server].includes(target?.server)
      ? e_total_bet_main.value
      : e_total_bet_server.value;
    if (target.gold - amount < 0)
      throw new Error('Tài khoản của bạn không đủ số dư');

    // Let query total amount of sesson Bet
    const old_bet_user = await this.userService.findOneUserBet({
      betId: betId,
      uid: uid,
      isEnd: false,
      server: server,
    });
    let total_bet_user = 0;
    let result_number = [];
    for (const betUser of old_bet_user) {
      total_bet_user += betUser.amount;
      if (!['1', '2', '3'].includes(betUser.server)) {
        if ('CTCXLTLX'.indexOf(betUser.result) <= -1) {
          result_number.push(betUser);
        }
      }
    }
    if ('CTCXLTLX'.indexOf(result) <= -1 && !['1', '2', '3'].includes(server)) {
      if (result_number.length + 1 > 3)
        throw new Error(`Tối đa cho cược dự đoán số là 3 lần`);
      if (
        result_number.reduce((a: any, b: any) => a + (b?.amount ?? 0), 0) +
          amount >
        200
      )
        throw new Error(
          'Tổng cược cho dự đoán số không được vượt quá 200 thỏi vàng',
        );
    }

    if (!this.isValidBet(result, old_bet_user))
      throw new Error('Bạn không được phép đặt 2 cầu');

    // console.log(total_bet_user, min_amount, max_amount, amount);
    if (total_bet_user + amount > total_amount)
      throw new Error(
        `Tổng giá trị cược cho phép ở Server ${server} là ${total_amount} thỏi vàng`,
      );

    // Check min limited bet amount
    if (amount < min_amount)
      throw new Error(`Số lượng cược nhỏ nhất là ${min_amount} thỏi vàng`);

    // Check max limited bet amount
    if (amount > max_amount)
      throw new Error(`Số lượng cược lớn nhất là ${max_amount} thỏi vàng`);
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

  //TODO ———————————————[Handle Message Event]———————————————
  async handleMessageSystem(data: string, server: any) {
    this.socketGateway.server.emit('noti-bet', {
      uid: '',
      content: data,
      server,
    });
    // save message
    await this.messageService.MessageCreate({ uid: '', content: data, server });
  }

  //TODO ———————————————[handle result data bet]———————————————
  @OnEvent('result-data-bet')
  async handleResultDataBet(data: ResultDataBet) {
    try {
      // console.log('Get random');
      const target = await this.eventRandomDrawModel.findOne({
        betId: data.betId,
        isEnd: false,
      });
      if (!target) return 'No';
      // console.log('Get random', target);
      this.socketGateway.server.emit('result-data-bet-re', {
        value: target.value,
        betId: data.betId,
      });
      return target.value;
    } catch (err) {}
  }

  //TODO ———————————————[Handle Message Chat User]———————————————
  @OnEvent('message-user')
  async handleMessageUser(data: MessagesChat) {
    const parameter = `message-chat`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const payload = await this.jwtService.verifyAsync(data.token, {
        secret: jwtConstants.secret,
      });
      const user = await this.userService.findById(payload?.sub);
      await this.userService.handleCreateUserActive({
        uid: user.id,
        active: JSON.stringify({
          name: 'Chat',
          content: data.content,
        }),
        currentGold: user.gold,
        newGold: user.gold,
      });
      const msg = await this.messageService.MessageCreate({
        uid: user?.id,
        content: data.content,
        server: data.server,
        username: user?.name ?? user?.username,
        meta: JSON.stringify({ avatar: user?.avatar, vip: user?.vip }),
      });
      this.socketGateway.server.emit('message-user-re', { status: true, msg });
    } catch (err) {
      this.socketGateway.server.emit('message-user-re', {
        status: false,
        msg: err.message,
      });
    } finally {
      release();
    }
  }

  async handleCreateUserActive(data: CreateUserActive) {
    return await this.userService.handleCreateUserActive(data);
  }
}

const TranslateKey = {
  '0': 'Khỉ Đỏ',
  '1': 'Khỉ Đen',
  C: 'Chẵn',
  L: 'Lẻ',
  T: 'Tài',
  X: 'Xỉu',
  CT: 'Chẵn Tài',
  LX: 'Lẻ Xỉu',
  LT: 'Lẻ Tài',
  CX: 'Chẵn Xỉu',
};
