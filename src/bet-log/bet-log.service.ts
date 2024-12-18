import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BetLog } from './schema/bet-log.schema';
import {
  CreateBetHistory,
  CreateBetLogDto,
  TopBetServer,
} from './dto/bet-log.dto';
import { BetServer } from './schema/bet-sv.schema';
import { BetHistory } from './schema/bet-history.schema';
import { EventRandom } from 'src/event/schema/eventRandom';
import { UserBet } from 'src/user/schema/userBet.schema';

@Injectable()
export class BetLogService {
  constructor(
    @InjectModel(BetLog.name)
    private readonly betLogModel: Model<BetLog>,
    @InjectModel(BetServer.name)
    private readonly betServerModel: Model<BetServer>,
    @InjectModel(BetHistory.name)
    private readonly betHistoryModel: Model<BetHistory>,
    @InjectModel(EventRandom.name)
    private readonly eventRandomDrawModel: Model<EventRandom>,
    @InjectModel(UserBet.name)
    private readonly userBetModel: Model<UserBet>,
  ) {}

  /**
   * Create The Bet map boss
   * @param data
   * @returns
   */
  async create(data: CreateBetLogDto) {
    return await this.betLogModel.create(data);
  }

  /**
   * Find The Bet map boss with Server
   * @param server
   * @returns
   */
  async findByServer(server: any) {
    const old_bet = await this.betLogModel
      .findOne({ server, isEnd: false })
      .sort({ updatedAt: -1 })
      .exec();
    return old_bet;
  }

  /**
   * Find The Bet map boss with ID
   * @param id
   * @returns
   */
  async findById(id: any) {
    const old_bet = await this.betLogModel.findById(id);
    return old_bet;
  }

  findAll() {
    return `This action returns all betLog`;
  }

  findOne(id: any) {
    return `This action returns a #${id} betLog`;
  }

  /**
   * Update The Bet map boss with ID
   * @param id
   * @param updateBetLogDto
   * @returns
   */
  async update(id: any, updateBetLogDto: any) {
    return await this.betLogModel.findByIdAndUpdate(id, updateBetLogDto, {
      upsert: true,
      new: true,
    });
  }

  remove(id: number) {
    return `This action removes a #${id} betLog`;
  }

  //TODO ———————————————[Bet Server]———————————————
  /**
   * Create The Bet Server (1,2,3) and 24/24
   * @param data
   * @returns
   */
  async createSv(data: CreateBetLogDto) {
    return await this.betServerModel.create(data);
  }

  /**
   * Find The Bet Server (1,2,3) and 24/24 with Server
   * @param server
   * @returns
   */
  async findSvByServer(server: any) {
    const old_bet = await this.betServerModel
      .findOne({ server, isEnd: false })
      .sort({ updatedAt: -1 })
      .exec();
    return old_bet;
  }

  /**
   * Find The Bet Server (1,2,3) and 24/24 with ID
   * @param id
   * @returns
   */
  async findSvById(id: any) {
    const old_bet = await this.betServerModel.findById(id);
    return old_bet;
  }

  /**
   * Update The Bet Server (1,2,3) and 24/24 with ID
   * @param id
   * @param updateBetLogDto
   * @returns
   */
  async updateSv(id: any, updateBetLogDto: any) {
    return await this.betServerModel.findByIdAndUpdate(id, updateBetLogDto, {
      upsert: true,
      new: true,
    });
  }

  //TODO ———————————————[Bet History]———————————————
  async findBetHistoryByServer(server: any) {
    const old_bet = await this.betHistoryModel
      .findOne({ server })
      .sort({ updatedAt: -1 })
      .exec();
    return old_bet;
  }

  async findBetHistoryById(id: any) {
    return await this.betHistoryModel.findById(id);
  }

  async createAndUpdateBetHistory(server: any, data: any) {
    return await this.betHistoryModel.findOneAndUpdate({ server }, data, {
      upsert: true,
      new: true,
    });
  }

  //TODO ———————————————[Top Bet Server]———————————————
  async handleTopBetServer(data: TopBetServer) {
    return await this.betServerModel
      .find({ server: data.server })
      .sort({ updatedAt: -1 })
      .limit(data.limited + 1);
  }
  async handleTopBetServerBoss(data: TopBetServer) {
    return await this.betLogModel
      .find({ server: data.server })
      .sort({ updatedAt: -1 })
      .limit(data.limited + 1);
  }

  //TODO ———————————————[Admin Server]———————————————
  async handleGetAllServer() {
    return await this.betServerModel.find();
  }

  async handleGetAllBoss() {
    return await this.betLogModel.find();
  }

  async handlerLive() {
    const sv = await this.betServerModel.findOne({
      isEnd: false,
      server: '24',
    });
    const boss1 = this.betLogModel
      .findOne({ server: '1' })
      .sort({ updatedAt: -1 });
    const boss2 = this.betLogModel
      .findOne({ server: '2' })
      .sort({ updatedAt: -1 });
    const boss3 = this.betLogModel
      .findOne({ server: '3' })
      .sort({ updatedAt: -1 });
    const boss = await Promise.all([boss1, boss2, boss3]);
    const data = [...boss, sv];
    const userBets = await this.userBetModel.find({
      betId: { $in: data.map((d) => d.id) },
    });
    return { livegame: data, userBets: userBets };
  }

  async getResult24(betId: string) {
    try {
      const targetReulst = await this.eventRandomDrawModel.findOne({
        betId: betId,
      });
      return targetReulst;
    } catch (err: any) {
      return err;
    }
  }

  async changeResult24(betId: string, newResult: string) {
    try {
      await this.eventRandomDrawModel.findOneAndUpdate(
        { betId: betId },
        {
          value: newResult,
        },
      );
      return 'ok';
    } catch (err: any) {
      return err;
    }
  }
}
