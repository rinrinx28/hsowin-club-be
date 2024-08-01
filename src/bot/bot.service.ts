import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Bot } from './schema/bot.schema';
import { Model } from 'mongoose';

@Injectable()
export class BotService {
  constructor(
    @InjectModel(Bot.name)
    private readonly botModel: Model<Bot>,
  ) {}

  async createAndUpdate(botData: any, data: any) {
    return await this.botModel.findOneAndUpdate(botData, data, {
      new: true,
      upsert: true,
    });
  }

  async getAll() {
    return await this.botModel.find();
  }
}
