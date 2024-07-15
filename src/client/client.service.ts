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
  ) {}
  private logger: Logger = new Logger('Client Auto');

  async getStatusBoss(data: StatusBoss) {
    const { content, server } = data;
    const old_bet = await this.betLogService.findByServer(server);
    let new_content = this.unitlService.hexToString(content);
    data.content = new_content;
    if (new_content.includes('Núi khỉ đỏ')) {
      data['type'] = 0;
      data['respam'] = 0;
      if (old_bet) {
        // Update End Bet
        await this.betLogService.update(old_bet?.id, {
          isEnd: true,
          result: `${data['type']}`,
          total: old_bet?.sendIn - old_bet?.sendOut,
        });
      }
    } else if (new_content.includes('Núi khỉ đen')) {
      data['type'] = 1;
      data['respam'] = 0;
      if (old_bet) {
        // Update End Bet
        await this.betLogService.update(old_bet?.id, {
          isEnd: true,
          result: `${data['type']}`,
          total: old_bet?.sendIn - old_bet?.sendOut,
        });
      }
    } else {
      data['type'] = 2;
      data['respam'] = 180;
      if (old_bet) {
        await this.betLogService.update(old_bet?.id, {
          server: server,
          timeEnd: this.addSeconds(new Date(), 180),
        });
      } else {
        await this.betLogService.create({
          server: server,
          timeEnd: this.addSeconds(new Date(), 180),
        });
      }
    }
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
    this.logger.log(`Boss Status: ${data.content}`);
    return 'ok';
  }

  async getStatusBot(data: StatusBot) {
    const { map, name } = data;
    let new_name = this.unitlService.hexToString(name);
    let new_map = this.unitlService.hexToString(map);
    data.map = new_map;
    data.name = new_name;
    await this.botService.createAndUpdate(data.name, data);
    this.logger.log(
      `Bot Status: Bot ${data.name} - Gold Current:${data?.gold} - Server: ${data?.server}`,
    );
    return 'ok';
  }

  async getTransaction(data: Transaction) {
    try {
      const { player_name, type, player_id } = data;
      let new_playerName = this.unitlService.hexToString(player_name);
      // Let find session with PlayerName
      const old_session = await this.sessionService.findByName(new_playerName);
      if (!old_session)
        throw new Error(
          'no|Bạn chưa tạo lệnh, xin vui lòng tạo lệnh tại hsowin.club !',
        );
      switch (type) {
        case 0:
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
        case 1:
          await this.sessionService.updateById(old_session.id, {
            status: '1',
          });
          //   Delete timeout transaction ...
          this.cronJobService.remove(old_session.id);
          this.logger.log(
            `Transaction Cancel: type:${old_session.type} - UID:${old_session.uid} - SessionID: ${old_session.id}`,
          );

          //   Update value gold of User ...
          if (old_session?.type === '1') {
            await this.userService.update(old_session?.uid, {
              $inc: {
                gold: +old_session?.amount,
              },
            });
          }
          return 'ok';
        default:
          await this.sessionService.updateById(old_session.id, {
            status: '2',
          });
          this.cronJobService.remove(old_session.id);
          this.logger.log(
            `Transaction Success: type:${old_session.type} - UID:${old_session.uid} - SessionID: ${old_session.id} - ${data?.gold_receive ?? data?.gold_trade}`,
          );
          //   Update value gold of User ...
          if (old_session?.type === '0') {
            await this.userService.update(old_session?.uid, {
              $inc: {
                gold: +data?.gold_receive,
              },
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
}
