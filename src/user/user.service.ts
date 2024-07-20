import { Injectable } from '@nestjs/common';
import {
  CreateClans,
  CreateUserBetDto,
  CreateUserDto,
  FindUserBetDto,
  MemberClans,
} from './dto/user.dto';
import { Model } from 'mongoose';
import { User } from './schema/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { UserBet } from './schema/userBet.schema';
import { Clans } from './schema/clans.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(UserBet.name)
    private readonly userBetModel: Model<UserBet>,
    @InjectModel(Clans.name)
    private readonly clansModel: Model<Clans>,
  ) {}
  //TODO ———————————————[User Model]———————————————
  async create(createUserDto: CreateUserDto) {
    return await this.userModel.create(createUserDto);
  }

  findAll() {
    return `This action returns all user`;
  }

  async findOne(username: any) {
    return await this.userModel.findOne({ username });
  }

  async findById(id: any) {
    const user = await this.userModel.findById(id);
    delete user?.pwd_h;
    return user;
  }

  async update(id: any, updateUserDto: any) {
    const user = await this.userModel.findByIdAndUpdate(id, updateUserDto, {
      upsert: true,
    });
    delete user.pwd_h;
    return user;
  }

  async remove(id: any) {
    return await this.userModel.findByIdAndDelete(id);
  }

  async getTopUserBet() {
    return await this.userModel.find().sort({ totalBet: -1 }).limit(10).exec();
  }

  async updateTotalBetUser(uid: any, amount: number) {
    return await this.userModel.findByIdAndUpdate(
      uid,
      {
        $inc: {
          totalBet: +amount,
        },
      },
      { upsert: true },
    );
  }

  //TODO ———————————————[User Bet Model]———————————————
  async createBet(createUserBetDto: CreateUserBetDto) {
    return await this.userBetModel.create(createUserBetDto);
  }

  async findByIdBet(id: any) {
    return await this.userBetModel.findById(id);
  }

  async updateBet(id: any, updateUserBetDto: any) {
    return await this.userBetModel.findByIdAndUpdate(id, updateUserBetDto, {
      upsert: true,
    });
  }

  async findOneUserBet(data: FindUserBetDto) {
    const result = await this.userBetModel.find(data);
    return result;
  }

  async findBetWithBetId(betId: any, server: any) {
    const result = await this.userBetModel.find({
      betId,
      server,
      isEnd: false,
    });
    return result;
  }

  //TODO ———————————————[Clans Model]———————————————
  async createClans(data: CreateClans) {
    return await this.clansModel.create(data);
  }

  async addMemberClans(data: MemberClans) {
    // Update member into clans
    await this.clansModel.findByIdAndUpdate(
      data?.clanId,
      {
        $inc: {
          member: +1,
        },
      },
      { upsert: true },
    );
    return await this.userModel.findByIdAndUpdate(
      data?.uid,
      {
        clansId: data?.clanId,
      },
      { upsert: true },
    );
  }

  async removeMemberClans(data: MemberClans) {
    await this.clansModel.findByIdAndUpdate(
      data?.clanId,
      {
        $inc: {
          member: -1,
        },
      },
      { upsert: true },
    );
    return await this.userModel.findByIdAndUpdate(
      data?.uid,
      {
        clansId: '',
      },
      { upsert: true },
    );
  }

  async removeClans(clanId: any) {
    await this.clansModel.findByIdAndDelete(clanId);
    return 'ok';
  }

  async updateTotalBetClans(amount: number, clansId: any) {
    return await this.clansModel.findByIdAndUpdate(clansId, {
      $inc: {
        totalBet: +amount,
      },
    });
  }

  async getTopClans() {
    return await this.clansModel.find().sort({ totalBet: -1 }).limit(10).exec();
  }
}
