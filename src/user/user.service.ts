import { Injectable } from '@nestjs/common';
import {
  CreateUserBetDto,
  CreateUserDto,
  FindUserBetDto,
} from './dto/user.dto';
import { Model } from 'mongoose';
import { User } from './schema/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { UserBet } from './schema/userBet.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(UserBet.name)
    private readonly userBetModel: Model<UserBet>,
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
}
