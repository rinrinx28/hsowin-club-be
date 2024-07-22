import { BadRequestException, Injectable } from '@nestjs/common';
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
import { CatchException } from 'src/common/common.exception';

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
    try {
      return await this.userModel.create(createUserDto);
    } catch (err) {
      throw new CatchException(err);
    }
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

  async getUserWithClansId(clansId: any) {
    return await this.userModel.find({
      $expr: {
        $eq: [{ $jsonPath: '$clan.clanId' }, clansId],
      },
    });
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
    try {
      // Check if owner was owner of clan
      const user = await this.findById(data.ownerId);
      const userClanJSON = JSON.parse(user?.clan);
      if ('clanId' in userClanJSON) {
        let OwnerTargetClan = await this.findClanWithId(userClanJSON?.clanId);
        if (user?.id === OwnerTargetClan.ownerId)
          throw new Error('You was owner of the Clan');
      }
      return await this.clansModel.create(data);
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async addMemberClans(data: MemberClans) {
    try {
      // Check if owner was owner of clan
      const target = await this.findById(data.uid);
      const targetClanJSON = JSON.parse(target?.clan);
      if ('clanId' in targetClanJSON) {
        let OwnerTargetClan = await this.findClanWithId(targetClanJSON?.clanId);
        if (target?.id === OwnerTargetClan.ownerId)
          throw new Error('You was owner of the Clan');
      }
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
      const clanInfo = {
        clanId: data?.clanId,
        timejoin: new Date(),
      };
      const clanInfoString = JSON.stringify(clanInfo);
      const user = await this.userModel
        .findByIdAndUpdate(
          data?.uid,
          {
            clan: clanInfoString,
          },
          { upsert: true },
        )
        .exec();
      return user;
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async removeMemberClans(data: MemberClans) {
    try {
      // Check if owner was owner of clan
      const target = await this.findById(data.uid);
      const targetClanJSON = JSON.parse(target?.clan);
      if ('clanId' in targetClanJSON) {
        let OwnerTargetClan = await this.findClanWithId(targetClanJSON?.clanId);
        if (target?.id === OwnerTargetClan.ownerId)
          throw new Error('You was owner of the Clan');
      }
      // Update member into clans
      await this.clansModel.findByIdAndUpdate(
        data?.clanId,
        {
          $inc: {
            member: -1,
          },
        },
        { upsert: true },
      );
      const user = await this.userModel
        .findByIdAndUpdate(
          data?.uid,
          {
            clan: '',
          },
          { upsert: true },
        )
        .exec();
      return user;
    } catch (err) {
      throw new BadRequestException(err.message);
    }
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

  async findClanWithId(id: any) {
    return await this.clansModel.findById(id);
  }

  async deleteClanWithOwner(data: MemberClans) {
    try {
      const targetClan = await this.findClanWithId(data.clanId);
      if (targetClan.ownerId !== data.uid)
        throw new Error('You not is the owner of clan');
      await this.clansModel.findByIdAndDelete(data.clanId);
      return 'ok';
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }
}
