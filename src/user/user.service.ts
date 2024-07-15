import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/user.dto';
import { Model } from 'mongoose';
import { User } from './schema/user.schema';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}
  async create(createUserDto: CreateUserDto) {
    return await this.userModel.create(createUserDto);
  }

  findAll() {
    return `This action returns all user`;
  }

  async findOne(username: any) {
    return await this.userModel.findOne({ username });
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
}
