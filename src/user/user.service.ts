import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  CreateClans,
  CreateUserActive,
  CreateUserBetDto,
  CreateUserDto,
  CreateUserPrize,
  Exchange,
  FindUserBetDto,
  MemberClans,
  UserBankWithDraw,
  UserBankWithDrawUpdate,
  UserTrade,
} from './dto/user.dto';
import { Model } from 'mongoose';
import { User } from './schema/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { UserBet } from './schema/userBet.schema';
import { Clans } from './schema/clans.schema';
import { CatchException } from 'src/common/common.exception';
import { Event } from 'src/event/schema/event.schema';
import { CreateEvent } from 'src/event/dto/event.dto';
import { ConfigExchange } from 'src/config/config';
import { UserWithDraw } from './schema/userWithdraw';
import { UserIp } from './schema/userIp.schema';
import { UserPrize } from './schema/prize.schema';
import { UserActive } from './schema/userActive';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(UserBet.name)
    private readonly userBetModel: Model<UserBet>,
    @InjectModel(Clans.name)
    private readonly clansModel: Model<Clans>,
    @InjectModel(Event.name)
    private readonly eventModel: Model<Event>,
    @InjectModel(UserWithDraw.name)
    private readonly userWithDrawModel: Model<UserWithDraw>,
    @InjectModel(UserIp.name)
    private readonly userIpModel: Model<UserIp>,
    @InjectModel(UserPrize.name)
    private readonly userPrizeModel: Model<UserPrize>,
    @InjectModel(UserActive.name)
    private readonly userActiveModel: Model<UserActive>,
  ) {}
  //TODO ———————————————[User Model]———————————————
  async create(createUserDto: CreateUserDto) {
    try {
      const target = await this.userModel.create(createUserDto);
      const event_wellcome = await this.eventModel.findOne({
        name: 'e-well-come',
      });
      // Event WellCome
      if (event_wellcome.status) {
        await this.userModel.findByIdAndUpdate(
          target.id,
          {
            $inc: {
              gold: +event_wellcome.value,
            },
          },
          { new: true, upsert: true },
        );
        target.gold = event_wellcome.value;
      }
      return target;
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
      new: true,
    });
    delete user.pwd_h;
    return user;
  }

  async remove(id: any) {
    return await this.userModel.findByIdAndDelete(id);
  }

  async getTopUserBet() {
    return await this.userModel.find().sort({ totalBet: -1 }).exec();
  }

  async updateTotalBetUser(uid: any, amount: number) {
    return await this.userModel.findByIdAndUpdate(
      uid,
      {
        $inc: {
          totalBet: +amount,
        },
      },
      { upsert: true, new: true },
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
      new: true,
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

  async deletOneUserBetWithID(id: any) {
    return await this.userBetModel.findByIdAndDelete(id);
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
          throw new Error('Bạn đã là chủ một Clan');
      }
      const targetClan = await this.clansModel.create(data);
      const targetUser = await this.update(data.ownerId, {
        clan: JSON.stringify({
          clanId: targetClan.id,
          timejoin: new Date(),
        }),
      });
      delete targetUser.pwd_h;
      return [targetClan, targetUser];
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
          throw new Error('Bạn là chủ của một Clan');
      }
      // Update member into clans
      await this.clansModel.findByIdAndUpdate(
        data?.clanId,
        {
          $inc: {
            member: +1,
          },
        },
        { upsert: true, new: true },
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
          { upsert: true, new: true },
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
          throw new Error('Bạn là chủ của một Clan');
      }
      // Update member into clans
      await this.clansModel.findByIdAndUpdate(
        data?.clanId,
        {
          $inc: {
            member: -1,
          },
        },
        { upsert: true, new: true },
      );
      const user = await this.userModel
        .findByIdAndUpdate(
          data?.uid,
          {
            clan: '',
          },
          { upsert: true, new: true },
        )
        .exec();
      return user;
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async updateTotalBetClans(amount: number, clansId: any) {
    return await this.clansModel.findByIdAndUpdate(
      clansId,
      {
        $inc: {
          totalBet: +amount,
        },
      },
      { upsert: true, new: true },
    );
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
        throw new Error('Bạn không phải là chủ một Clan');
      await this.clansModel.findByIdAndDelete(data.clanId);
      return 'ok';
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  //TODO ———————————————[Handle Event Model]———————————————
  async handleCreateEventModel(data: CreateEvent) {
    return await this.eventModel.create(data);
  }

  async handleGetEventModel(name: string) {
    return await this.eventModel.findOne({ name });
  }

  async handleGetEventModels(data: any) {
    return await this.eventModel.find(data);
  }

  async handleUpdateEventModel(name: string, data: any) {
    return await this.eventModel.findOneAndUpdate({ name }, data, {
      upsert: true,
    });
  }

  //TODO ———————————————[Handle Exchange]———————————————
  async handleExchangeGold(data: Exchange, user) {
    try {
      const min = ConfigExchange.diamon;
      const percent = ConfigExchange.gold;
      if (data.diamon < min)
        throw new Error(
          'Bạn không đủ kim cương để đổi, tối thiêu 50 kim cương',
        );
      let value = (data.diamon / min) * percent;
      const target = await this.update(user.sub, {
        $inc: {
          gold: +value,
          diamon: -data.diamon,
        },
      });
      delete target.pwd_h;
      return target;
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  splitDecimal(number) {
    const integerPart = Math.floor(number);
    const decimalPart = number - integerPart; // Đảm bảo chính xác đến nhiều chữ số
    return {
      integerPart,
      decimalPart,
    };
  }

  async handleUserTrade(data: UserTrade) {
    try {
      const target = await this.userModel.findById(data?.targetId);
      if (!target) throw new ForbiddenException();
      const user = await this.userModel.findById(data?.userId);
      if (!user) throw new ForbiddenException();
      if (user.gold - data?.amount <= 0) throw new BadRequestException();
      const res = await this.userModel.findByIdAndUpdate(
        data?.userId,
        {
          $inc: {
            gold: -data?.amount,
          },
        },
        { new: true, upsert: true },
      );
      await this.userModel.findByIdAndUpdate(
        data?.targetId,
        {
          $inc: {
            gold: +data?.amount,
          },
        },
        { new: true, upsert: true },
      );
      return {
        message: 'Đã chuyển thành công',
        status: true,
        data: res,
      };
    } catch (err) {
      throw new CatchException(err);
    }
  }

  async handleUserBankWithdraw(data: UserBankWithDraw) {
    try {
      const { uid, amount } = data;
      const target = await this.userModel.findById(uid);
      if (!target)
        return { message: 'Không tìm thấy người chơi!', status: false };
      const eventBankWithDraw =
        await this.handleGetEventModel('e-withdraw-bank');
      const old_order = await this.userWithDrawModel.findOne({
        uid: uid,
        status: '0',
      });
      if (old_order)
        throw new Error('Phiên trước chưa kết thúc, xin vui lòng kiểm tra lại');
      let gold = amount * (eventBankWithDraw?.value ?? 0.0062);
      if (target.gold - gold < 0)
        return { message: 'Tài khoản không đủ số dư để thực hiện lệnh rút!' };

      await this.userModel.findByIdAndUpdate(uid, {
        $inc: {
          gold: -gold,
        },
      });
      return await this.userWithDrawModel.create({ ...data, gold });
    } catch (err) {
      throw new CatchException(err);
    }
  }

  async handleUserBankWithdrawUpdate(data: UserBankWithDrawUpdate) {
    try {
      const { uid, withdrawId, status } = data;
      const target = await this.userModel.findById(uid);
      if (!target)
        return { message: 'Không tìm thấy người chơi!', status: false };
      const targetWithDraw = await this.userWithDrawModel.findById(withdrawId);

      // gold
      if (status === '2') {
        await this.userModel.findByIdAndUpdate(uid, {
          $inc: {
            gold: +targetWithDraw.gold,
          },
        });
      }
      return await this.userWithDrawModel.findByIdAndUpdate(
        withdrawId,
        {
          status,
        },
        { upsert: true, new: true },
      );
    } catch (err) {
      throw new CatchException(err);
    }
  }

  //TODO ———————————————[Admin Server]———————————————
  async handleGetAllUser() {
    return await this.userModel.find();
  }
  async handleGetAllUserbet() {
    return await this.userBetModel.find();
  }

  //TODO ———————————————[Non User Call]———————————————
  async handleUserBetLogs(limit: number, server: any) {
    const data = await this.userBetModel
      .find({ server: server })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .exec();
    return {
      status: true,
      data,
    };
  }

  async handleUserRank() {
    const data = await this.userModel
      .find()
      .sort({ totalBet: -1, updatedAt: -1 })
      .limit(7)
      .exec();
    let new_data = data.map((user) => {
      const { name, totalBet, _id, username } = user.toObject();
      return { name, totalBet, _id, username };
    });
    return {
      data: new_data,
      status: true,
    };
  }

  async handleUserBetLog(page: number, limit: number, uid: string) {
    const data = await this.userBetModel
      .find({ uid, isEnd: true })
      .sort({ updatedAt: -1 })
      // .limit(limit)
      // .skip((page - 1) * limit)
      .exec();
    return {
      status: true,
      data,
    };
  }

  // async handleData() {
  //   const users = await this.userModel.find();
  //   for (const user of users) {
  //     await this.userModel.findByIdAndUpdate(user.id, {
  //       isReason: 'Nothing',
  //     });
  //   }
  // }

  //TODO ———————————————[Handle IP USer]———————————————
  async handleUserWithIp(ip_address: any) {
    return await this.userIpModel.findOne({ ip_address });
  }
  async handleAddIp(uid: any, ip_address: any) {
    const targetIp = await this.userIpModel.findOne({ ip_address });
    if (!targetIp) {
      return await this.userIpModel.create({ ip_address, countAccount: [uid] });
    }
    return await this.userIpModel.findOneAndUpdate(
      { ip_address },
      {
        ip_address,
        countAccount: [...targetIp.countAccount.filter((i) => i !== uid), uid],
      },
    );
  }

  async handleUserUpdateIp(uid: any, ip_address: any) {
    return await this.userModel.findByIdAndUpdate(
      uid,
      { ip_address },
      { new: true, upsert: true },
    );
  }

  //TODO ———————————————[Handle User Prize]———————————————
  async handleUserPrizeCreate(data: CreateUserPrize) {
    return await this.userPrizeModel.create(data);
  }

  //TODO ———————————————[Handle User Active]———————————————
  async handleCreateUserActive(data: CreateUserActive) {
    try {
      return await this.userActiveModel.create(data);
    } catch (err) {
      return err.message;
    }
  }
}
