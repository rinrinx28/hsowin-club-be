import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Boss } from './schema/boss.schema';
import { UpdateBossDto } from './dto/boss.dto';

@Injectable()
export class BossService {
  constructor(
    @InjectModel(Boss.name)
    private readonly bossModel: Model<Boss>,
  ) {}

  async findServer(server: any) {
    return await this.bossModel.findOne({ server: server });
  }
  async createAndUpdate(server: any, data: UpdateBossDto) {
    return await this.bossModel.findOneAndUpdate({ server }, data, {
      new: true,
      upsert: true,
    });
  }
}
