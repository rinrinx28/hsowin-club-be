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
  ) {}
  private logger: Logger = new Logger('Client Auto');

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
    try {
      const { player_name, type, player_id, service_id, server } = data;
      if (type === '0') {
        let new_playerName = this.unitlService.hexToString(player_name);
        // Let find session with PlayerName
        const old_session =
          await this.sessionService.findByName(new_playerName);
        if (!old_session)
          throw new Error(
            'no|Bạn chưa tạo lệnh, xin vui lòng tạo lệnh tại hsowin.vip !',
          );
        if (old_session.server !== server)
          throw new Error(
            'no|Bạn chưa tạo lệnh, xin vui lòng tạo lệnh tại hsowin.vip !',
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
            uid: target?.uid,
            active: `Hủy Rút vàng SESSION: ${service_id}`,
            currentGold: target.gold,
            newGold: target.gold + old_session?.amount,
          });
          await this.userService.update(old_session?.uid, {
            $inc: {
              gold: +old_session?.amount,
              trade: -old_session?.amount,
              limitedTrade: +old_session?.amount,
            },
          });
        } else {
          await this.userService.handleCreateUserActive({
            uid: target?.uid,
            active: `Hủy Nạp vàng SESSION: ${service_id}`,
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
            uid: target?.uid,
            active: `Nạp vàng Thành Công SESSION: ${old_session.id}`,
            currentGold: target.gold,
            newGold: target.gold + data?.gold_receive,
          });
          await this.userService.update(old_session?.uid, {
            $inc: {
              gold: +data?.gold_receive,
            },
          });
        } else {
          await this.userService.handleCreateUserActive({
            uid: target?.uid,
            active: `Rút vàng Thành Công SESSION: ${old_session.id}`,
            currentGold: target.gold,
            newGold: target.gold,
          });
        }
        return 'ok';
      }
    } catch (err) {
      return err.message;
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
    } catch (err) {
      // throw new CatchException(err);
    }
  }
}
