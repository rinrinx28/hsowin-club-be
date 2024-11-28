import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SocketGateway } from 'src/socket/socket.gateway';
import { UnitlService } from 'src/unitl/unitl.service';
import { StatusBoss, StatusBot, Transaction } from './dto/client.dto';
import { BotService } from 'src/bot/bot.service';
import { BossService } from 'src/boss/boss.service';
import { SessionService } from 'src/session/session.service';
import { CronjobService } from 'src/cronjob/cronjob.service';
import { UserService } from 'src/user/user.service';
import { BetLogService } from 'src/bet-log/bet-log.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CatchException } from 'src/common/common.exception';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event } from 'src/event/schema/event.schema';
import * as moment from 'moment';
import { Mutex } from 'async-mutex';
import { BotActive } from './schema/botActive.schema';

@Injectable()
export class ClientService {
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
    @InjectModel(Event.name)
    private readonly eventModel: Model<Event>,
    @InjectModel(BotActive.name)
    private readonly BotActiveModel: Model<BotActive>,
  ) {}
  private logger: Logger = new Logger('Client Auto');
  private readonly mutexMap = new Map<string, Mutex>();

  async getStatusBoss(data: StatusBoss) {
    await this.eventEmitter.emitAsync('status-boss', data);
    return 'ok';
  }

  async getStatusBot(data: StatusBot) {
    const { map, name } = data;
    let new_name = this.unitlService.hexToString(name);
    let new_map = this.unitlService.hexToString(map);
    data.map = new_map;
    data.name = new_name;
    await this.botService.createAndUpdate(
      { name: data.name, botId: data.id },
      data,
    );
    this.logger.log(
      `Bot Status: Bot ${data.name} - Gold Current:${data?.gold} - Server: ${data?.server}`,
    );
    this.socketGateway.server.emit('status-bot', data);
    return 'ok';
  }

  async getTransaction(data: Transaction) {
    const parameter = `${data.bot_id}.handleClaimVip`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const { player_name, type, player_id, service_id, server, bot_id } = data;
      const e_value_diamom_claim = await this.eventModel.findOne({
        name: 'e-value-diamon-claim',
      });
      if (type === '0') {
        let new_playerName = this.unitlService.hexToString(player_name);
        // Let find session with PlayerName
        const old_session =
          await this.sessionService.findByName(new_playerName);
        if (!old_session)
          throw new Error(
            'no|Bạn chưa tạo lệnh, xin vui lòng tạo lệnh tại hsgame.me !',
          );
        if (old_session.server !== server)
          throw new Error(
            'no|Bạn chưa tạo lệnh, xin vui lòng tạo lệnh tại hsgame.me !',
          );
        if (old_session.type === '0') {
          this.logger.log(
            `Nap: ok|${player_id}|${old_session.id}|${old_session.type}`,
          );
          return `ok|${player_id}|${old_session.id}|${old_session.type}`;
        } else {
          this.logger.log(
            `Rut: ok|${player_id}|${old_session.id}|${old_session.type}|${old_session.amount}`,
          );
          return `ok|${player_id}|${old_session.id}|${old_session.type}|${old_session.amount}`;
        }
      } else if (type === '1') {
        const old_session = await this.sessionService.findByID(service_id);
        const res_session = await this.sessionService.updateById(
          old_session.id,
          {
            status: '1',
          },
        );
        //   Delete timeout transaction ...
        this.cronJobService.remove(old_session.id);
        this.logger.log(
          `Transaction Cancel: type:${old_session.type} - UID:${old_session.uid} - SessionID: ${old_session.id}`,
        );

        //   Update value gold of User ...
        const target = await this.userService.findById(old_session?.uid);
        if (old_session?.type === '1') {
          await this.userService.handleCreateUserActive({
            uid: old_session?.uid,
            active: JSON.stringify({
              name: 'Hủy rút vàng',
              id: service_id,
            }),
            currentGold: target.gold,
            newGold: target.gold + Number(old_session?.amount),
          });
          await this.userService.update(old_session?.uid, {
            $inc: {
              gold: +Number(old_session?.amount),
              trade: -Number(old_session?.amount),
              limitedTrade: +Number(old_session?.amount),
            },
          });
        } else {
          await this.userService.handleCreateUserActive({
            uid: old_session?.uid,
            active: JSON.stringify({
              name: 'Hủy nạp vàng',
              id: service_id,
            }),
            currentGold: target.gold,
            newGold: target.gold,
          });
        }

        this.socketGateway.server.emit('session-res', res_session.toObject());
        return 'ok';
      } else {
        const old_session = await this.sessionService.findByID(service_id);
        const res_session = await this.sessionService.updateById(
          old_session.id,
          {
            status: '2',
            recive: +(Number(data?.gold_receive) > 0
              ? Number(data?.gold_receive)
              : Number(data?.gold_trade)),
          },
        );
        this.cronJobService.remove(old_session.id);
        this.logger.log(
          `Transaction Success: type:${old_session.type} - UID:${old_session.uid} - SessionID: ${old_session.id} - ${data?.gold_receive ?? data?.gold_trade}`,
        );
        this.socketGateway.server.emit('session-res', res_session.toObject());

        //   Update value gold of User ...
        const target = await this.userService.findById(old_session?.uid);
        if (old_session?.type === '0') {
          await this.userService.handleCreateUserActive({
            uid: target.id,
            active: JSON.stringify({
              name: 'Nạp vàng thành công',
              id: service_id,
            }),
            currentGold: target.gold,
            newGold: target.gold + Number(data?.gold_receive),
          });
          //TODO ———————————————[Handle VIP]———————————————
          // Check vip
          const e_value_vip =
            await this.userService.handleGetEventModel('e-value-vip');
          const value_vip = JSON.parse(e_value_vip.option);
          const targetBank = target.totalBank + Number(data?.gold_receive);
          // Find Level VIP 0 - 6 ( 1 - 7 )
          const targetVip = this.userService.findPosition(
            value_vip,
            targetBank,
          );
          // Set Level VIP
          let start_data = moment();
          let end_data = moment().add(1, 'month');
          let data_vip = this.userService.handleGenVipClaim(
            start_data,
            end_data,
          );
          // Check OLD VIP in user
          if (target.vip !== 0) {
            await this.userService.handleCreateUserActive({
              uid: old_session?.uid,
              active: JSON.stringify({
                name: 'VIP Upgrade',
                currentVip: target.vip,
                newVip: targetVip + 1,
              }),
              currentGold: target.gold,
              newGold: target.gold,
            });
          } else {
            // Check Old VIP in db
            const old_targetVip = await this.userService.handleFindUserVip(
              old_session?.uid,
            );
            if (!old_targetVip) {
              // Create new VIP in db
              await this.userService.handleCreateUserVip({
                data: JSON.stringify(data_vip),
                timeEnd: end_data,
                uid: old_session?.uid,
              });
            } else {
              // Update VIP in db
              await this.userService.handleUpdateUserVip(old_session?.uid, {
                data: JSON.stringify(data_vip),
                timeEnd: end_data,
                isEnd: false,
              });
            }

            await this.userService.handleCreateUserActive({
              uid: old_session?.uid,
              active: JSON.stringify({
                name: 'Set VIP',
                currentVip: target.vip,
                newVip: targetVip + 1,
              }),
              currentGold: target.gold,
              newGold: target.gold,
            });
          }

          // Update User
          await this.userService.update(old_session?.uid, {
            $inc: {
              gold: +Number(data?.gold_receive),
              totalBank: +Number(data?.gold_receive),
              diamon: +e_value_diamom_claim.value * Number(data?.gold_receive),
            },
            vip: targetVip + 1,
          });
          await this.userService.updateTopBankWithUID(old_session.uid, {
            $inc: {
              amount: +Number(data.gold_receive),
            },
            username: target.name,
          });
        } else {
          await this.userService.handleCreateUserActive({
            uid: target.id,
            active: JSON.stringify({
              name: 'Rút vàng thành công',
              id: service_id,
            }),
            currentGold: target.gold,
            newGold: target.gold,
          });
        }
        await this.BotActiveModel.create({
          botId: bot_id,
          currentGold: data.gold_current,
          newGold: data.gold_last,
          name: target.name,
          uid: target.id,
          playerName: player_name,
          playerId: player_id,
          type: old_session?.type,
          serviceId: old_session.id,
        });
        return 'ok';
      }
    } catch (err) {
      return err.message;
    } finally {
      release();
    }
  }

  addSeconds(date: Date, seconds: number): Date {
    return new Date(date.getTime() + seconds * 1000);
  }

  generateRandomSixDigitNumber() {
    return Math.floor(100000 + Math.random() * 900000);
  }

  //TODO ———————————————[Handle Banking]———————————————
  async handleBankUpdate(data: any) {
    try {
      return await this.sessionService.handleUpdateBank(
        data?.data?.paymentLinkId,
        '1',
      );
    } catch (err) {}
  }
}
