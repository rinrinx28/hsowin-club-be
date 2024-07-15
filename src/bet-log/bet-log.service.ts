import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BetLog } from './schema/bet-log.schema';
import { CreateBetLogDto } from './dto/bet-log.dto';

@Injectable()
export class BetLogService {
  constructor(
    @InjectModel(BetLog.name)
    private readonly betLogModel: Model<BetLog>,
  ) {}
  async create(data: CreateBetLogDto) {
    return await this.betLogModel.create(data);
  }

  async findByServer(server: any) {
    const old_bet = await this.betLogModel
      .findOne({ server, isEnd: false })
      .sort({ updatedAt: -1 })
      .exec();
    return old_bet;
  }

  findAll() {
    return `This action returns all betLog`;
  }

  findOne(id: number) {
    return `This action returns a #${id} betLog`;
  }

  async update(id: number, updateBetLogDto: any) {
    return await this.betLogModel.findByIdAndUpdate(id, updateBetLogDto, {
      upsert: true,
    });
  }

  remove(id: number) {
    return `This action removes a #${id} betLog`;
  }
}
