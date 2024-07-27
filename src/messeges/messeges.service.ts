import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Messeges } from './schema/messeges.schema';
import { Model } from 'mongoose';
import { CreateMessage } from './dto/message.dto';

@Injectable()
export class MessegesService {
  constructor(
    @InjectModel(Messeges.name)
    private readonly messageModel: Model<Messeges>,
  ) {}

  async MessageCreate(data: CreateMessage) {
    return await this.messageModel.create(data);
  }

  async MessageGetAll(page: number, limit: number) {
    return await this.messageModel
      .find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();
  }
}
