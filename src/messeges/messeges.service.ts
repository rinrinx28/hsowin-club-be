import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Messeges } from './schema/messeges.schema';
import { MessegesBan } from './schema/messegesBan.schema';
import { Model } from 'mongoose';
import { CreateMessage, CreateMessagesBan } from './dto/message.dto';

@Injectable()
export class MessegesService {
  constructor(
    @InjectModel(Messeges.name)
    private readonly messageModel: Model<Messeges>,
    @InjectModel(MessegesBan.name)
    private readonly messageBanModel: Model<MessegesBan>,
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

  async MessegeBan(data: CreateMessagesBan) {
    return await this.messageBanModel.findOneAndUpdate(
      { uid: data.uid },
      data,
      { new: true, upsert: true },
    );
  }

  async FindMessegesBanUser(uid: string) {
    return await this.messageBanModel.findOne({ uid: uid });
  }

  // Get Message Clan with ClanId
  async clanMessage(id: string) {
    try {
      if (id.length === 0) throw new Error('Bạn không có bang hội!');
      const msg = await this.messageModel
        .find({ server: id })
        .sort({ updatedAt: -1 })
        .limit(10);
      return msg;
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }
}
