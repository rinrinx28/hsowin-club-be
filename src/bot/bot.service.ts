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

  async createAndUpdate(botName: any, data: any) {
    return await this.botModel.findOneAndUpdate({ name: botName }, data, {
      new: true,
      upsert: true,
    });
  }
}
