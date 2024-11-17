import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  ClaimMission,
  CreateClans,
  CreateUserActive,
  CreateUserBetDto,
  CreateUserDto,
  CreateUserPrize,
  CreateUserVip,
  Exchange,
  FindUserBetDto,
  MemberClans,
  StopUserVip,
  UpdateUserVip,
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
import { UserVip } from './schema/userVip.schema';
import { MissionDaily } from './schema/missionDaily.schema';
import * as moment from 'moment';
import { Mutex } from 'async-mutex';
import { PenningClans } from './schema/PenningClans.schema';
import { TopBank } from './schema/topBank.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Messeges } from 'src/messeges/schema/messeges.schema';
import { SocketGateway } from 'src/socket/socket.gateway';

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
    @InjectModel(UserVip.name)
    private readonly userVipModel: Model<UserVip>,
    @InjectModel(MissionDaily.name)
    private readonly missionDailyModel: Model<MissionDaily>,
    @InjectModel(PenningClans.name)
    private readonly penningClansModel: Model<PenningClans>,
    @InjectModel(TopBank.name)
    private readonly topBankModel: Model<TopBank>,
    @InjectModel(Messeges.name)
    private readonly messagesModel: Model<Messeges>,
    private eventEmitter: EventEmitter2,
    private readonly socketGateway: SocketGateway,
  ) {}
  private logger: Logger = new Logger('UserService');
  private readonly mutexMap = new Map<string, Mutex>();
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

  async findAll(data: any) {
    return await this.userModel.find(data);
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

  async updateMany(filter: any, update: any) {
    return this.userModel.updateMany(filter, update);
  }

  async updateAll(updateUserDto: any) {
    return await this.userModel.updateMany({}, updateUserDto);
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
      if (!user) throw new Error('Người dùng không tồn tại!');
      // Config event;
      const e_clans_price = await this.handleGetEventModel('e-clans-price');
      const userClanJSON = JSON.parse(user?.clan);
      if ('clanId' in userClanJSON) {
        let OwnerTargetClan = await this.findClanWithId(userClanJSON?.clanId);
        if (user?.id === OwnerTargetClan.ownerId)
          throw new Error('Bạn đã là chủ một Clan');
      }
      const clans_prices: number[] = JSON.parse(e_clans_price.option);
      const clans_price = clans_prices[parseInt(data.typeClan, 10) - 1];
      if (user.gold - clans_price <= 0)
        throw new Error('Xin lỗi, bạn không đủ thỏi vàng để tạo Bang Hội!');

      const targetClan = await this.clansModel.create(data);
      const targetUser = await this.update(data.ownerId, {
        clan: JSON.stringify({
          clanId: targetClan.id,
          timejoin: new Date(),
        }),
        $inc: {
          gold: -clans_price,
        },
      });
      // Delete All Penning
      await this.penningClansModel.deleteMany({ userId: data.ownerId });
      let new_target_user = targetUser.toObject();
      delete new_target_user.pwd_h;
      await this.getInfoClan(targetClan.id);
      return {
        status: true,
        data: [targetClan, new_target_user],
      };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async addMemberClans(data: MemberClans) {
    try {
      // Check if owner was owner of clan
      const target = await this.userModel.findById(data.uid);
      if (!target) throw new Error('Người dùng không tồn tại!');
      const targetClan = await this.clansModel.findById(data.clanId);
      if (!targetClan) throw new Error('Bang Hội không tồn tại!');
      const targetClanJSON = JSON.parse(target?.clan);
      if ('clanId' in targetClanJSON) {
        let OwnerTargetClan = await this.findClanWithId(targetClanJSON?.clanId);
        if (target?.id === OwnerTargetClan.ownerId)
          throw new Error('Bạn là chủ của một Clan');
      }
      // Check old penning a clan;
      let target_penning = await this.penningClansModel.findOne({
        userId: data.uid,
        clanId: data.clanId,
      });
      if (target_penning)
        throw new Error('Xin lỗi, bạn đã nộp đơn xin gia nhập Bang hội này!');
      // Add member to penning clans;
      await this.penningClansModel.create({
        userId: data.uid,
        clanId: data.clanId,
      });
      await this.getInfoClan(targetClan.id);
      return {
        status: true,
        message: `Bạn đã gửi yêu cầu tham gia Bang Hội ${targetClan.clanName}`,
      };
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
          throw new Error(
            'Bạn là chủ của một Clan, bạn không thể rời bỏ Clan của mình!',
          );
      }
      // Update member into clans
      const target_clans = await this.clansModel.findByIdAndUpdate(
        data?.clanId,
        {
          $inc: {
            member: -1,
            totalBet: -target.totalClan,
          },
        },
        { upsert: true, new: true },
      );
      let target_user = (
        await this.userModel.findByIdAndUpdate(
          data?.uid,
          {
            clan: '{}',
            totalClan: 0,
          },
          { upsert: true, new: true },
        )
      ).toObject();
      delete target_user.pwd_h;
      await this.getInfoClan(target_clans.id);
      this.socketGateway.server.emit('clan-kick', {
        uid: data?.uid,
        clanId: data.clanId,
        user: target_user,
      });
      return {
        status: true,
        data: [target_clans, target_user],
      };
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

  async getTopClans(limit?: number) {
    return await this.clansModel
      .find()
      .sort({ totalBet: -1 })
      .limit(limit ?? 7)
      .exec();
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
      const list_user = await this.userModel.find({
        clan: {
          $regex: `${targetClan.id}`,
        },
      });
      let list_uid = list_user.map((u) => u.id);
      await this.userModel.updateMany(
        { _id: { $in: list_uid } },
        { $set: { clan: '{}', totalClan: 0 } },
      );
      await this.messagesModel.deleteMany({
        server: data.clanId,
      });
      let owner = (await this.userModel.findById(data.uid)).toObject();
      delete owner.pwd_h;

      this.socketGateway.server.emit('clan-delete', targetClan.id);
      return {
        status: true,
        data: owner,
        message: 'Bạn đã xóa thành công bang Hội!',
      };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async clansGet(find = {}) {
    return await this.clansModel.find(find);
  }

  async clansInfo(id: any) {
    try {
      const clan_data = await this.clansModel.findById(id);
      if (!clan_data) throw new Error('Bang hội không tồn tại!');
      // Fetch User of Clans
      const clan_users = await this.userModel.find({
        clan: {
          $regex: `${clan_data.id}`,
        },
      });
      const users = clan_users.map((u) => {
        let {
          pwd_h,
          createdAt,
          diamon,
          email,
          ip_address,
          isBan,
          isReason,
          server,
          type,
          updatedAt,
          totalBank,
          limitedTrade,
          trade,
          username,
          ...res
        } = u.toObject();
        return res;
      });
      return { ...clan_data.toObject(), members: users };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async handlerGetPenningClans(id: any) {
    try {
      const target_penning = await this.penningClansModel.find({
        clanId: id,
      });
      const list_user = target_penning.map((p) => p.userId);
      let users = await this.userModel.find({
        _id: {
          $in: list_user,
        },
      });
      let new_users = users.map((u) => {
        let user = u.toObject();
        delete user.pwd_h;
        return user;
      });
      return {
        penings: target_penning,
        users: new_users,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  async handleAcpectUserJoinClans(id: any) {
    try {
      const penning_data = await this.penningClansModel.findById(id);

      if (!penning_data) throw new Error('Đơn gia nhập không tồn tại!');
      if (penning_data.isAcpect)
        throw new Error('Đơn xin gia nhập đã được duyệt!');

      const { userId, clanId } = penning_data;

      const target_user = await this.userModel.findById(userId);
      const target_clans = await this.clansModel.findById(clanId);

      if (!target_user) throw new Error('Người dùng không tồn tại!');
      if (!target_clans) throw new Error('Bang hội không tồn tại!');

      const e_clans_members_limit = await this.handleGetEventModel(
        'e-clans-limit-members',
      );
      const clans_members_limit = e_clans_members_limit.value;

      const targetClanJSON = JSON.parse(target_user?.clan);
      if ('clanId' in targetClanJSON) {
        let OwnerTargetClan = await this.findClanWithId(clanId);
        if (target_user?.id === OwnerTargetClan.ownerId)
          throw new Error(
            'Bạn là chủ của một Bang Hội, bạn không thể gia nhập vào một Bang Hội khác!',
          );
      }

      if (target_clans.member + 1 > clans_members_limit)
        throw new Error(
          `Thành viên tối đa của Bang Hội là ${clans_members_limit}`,
        );
      // Update member into the clans;
      const clans = await this.clansModel.findByIdAndUpdate(
        clanId,
        {
          $inc: {
            member: +1,
          },
        },
        { upsert: true, new: true },
      );
      const clanInfo = {
        clanId: clanId,
        timejoin: new Date(),
      };
      const clanInfoString = JSON.stringify(clanInfo);
      const user = (
        await this.userModel
          .findByIdAndUpdate(
            userId,
            {
              clan: clanInfoString,
            },
            { upsert: true, new: true },
          )
          .exec()
      ).toObject();
      delete user.pwd_h;
      await this.penningClansModel.deleteMany({ userId: userId });
      await this.getInfoClan(clanId);
      this.socketGateway.server.emit('clan-notice', {
        uid: userId,
        clanId: clanId,
        user: user,
      });
      return {
        status: true,
        data: [clans, user],
      };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  async handlerDeclineUserJoinClans(id: any) {
    try {
      await this.penningClansModel.findByIdAndDelete(id);
      return {
        status: true,
        message: 'Bạn đã xóa đơn xin gia nhập thành công!',
        data: null,
      };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  async handlerClanOwner({ userId, clanId }: { userId: any; clanId: string }) {
    try {
      const target_clans = await this.clansModel.findById(clanId);
      if (!target_clans) throw new Error('Bang hội không tồn tại!');
      if (target_clans.ownerId !== userId)
        throw new Error('Bạn không phải chủ Bang hội!');
      return true;
    } catch (err: any) {
      return false;
    }
  }

  async resetTotalBetClan() {
    return await this.clansModel.updateMany(
      {},
      {
        $set: {
          totalBet: 0,
        },
      },
    );
  }

  async getInfoClan(id: any) {
    const clanInfo = await this.clansInfo(id);
    this.socketGateway.server.emit('clan-update', clanInfo);
    return;
  }

  async handlerUpdateClan(body: {
    type: 'des' | 'type';
    clanId: string;
    data: string;
    uid: string;
  }) {
    try {
      const { clanId, type, data, uid } = body;
      const clan = await this.clansModel.findById(clanId);
      if (!clan) throw new Error('Bang hội không tồn tại!');

      const user = await this.userModel.findById(uid);
      if (!user) throw new Error('Người dùng không tồn tại!');

      if (type === 'des') {
        clan.descriptions = data;
        await clan.save();
        return { clan: clan.toObject(), user: null };
      } else {
        const e_clans_price = await this.handleGetEventModel('e-clans-price');
        const clans_prices: number[] = JSON.parse(e_clans_price.option);
        const clans_price = clans_prices[parseInt(data, 10) - 1];
        if (user.gold - clans_price <= 0)
          throw new Error(
            'Xin lỗi, bạn không đủ thỏi vàng để đổi biểu tượng Bang Hội!',
          );

        clan.typeClan = data;
        await clan.save();
        user.gold -= clans_price;
        await user.save();
        const user_n = user.toObject();
        delete user_n.pwd_h;
        return { clan: clan.toObject(), user: user_n };
      }
    } catch (err: any) {
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
  async handleExchangeGold(data: Exchange, token) {
    const parameter = `user-exchange`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const percent = await this.handleGetEventModel('e-percent-diamon-trade');
      const user = await this.findById(token?.sub);
      if (user.vip === 0)
        throw new Error('Bạn phải đạt tối thiểu VIP 1 để dùng chức năng này');
      if (user.diamon - data.diamon < 0)
        throw new Error('Bạn không đủ lục bảo để đổi');
      let value = data.diamon / percent.value;
      const target = await this.update(user.id, {
        $inc: {
          gold: +value,
          diamon: -data.diamon,
        },
      });
      const result = target.toObject();
      await this.handleCreateUserActive({
        uid: target.id,
        currentGold: target.gold,
        newGold: target.gold + value,
        active: JSON.stringify({
          name: 'Exchange Gold',
          diamon: data.diamon,
        }),
      });
      delete result.pwd_h;
      return {
        message: `Đã đổi thành công ${data.diamon} Lục Bảo thành ${value} Thỏi Vàng`,
        status: true,
        data: result,
      };
    } catch (err) {
      throw new BadRequestException(err.message);
    } finally {
      release();
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
      if (!target) throw new ForbiddenException('Không tìm thấy người chơi');
      const user = await this.userModel.findById(data?.userId);
      if (!user) throw new ForbiddenException('Không tìm thấy người chơi');
      if (user.vip === 0)
        throw new BadRequestException(
          'Xin lỗi, bạn phải đạt tối thiểu VIP 1 mới có thể dùng chức năng này',
        );
      if (user.gold - data?.amount <= 0)
        throw new BadRequestException(
          'Xin lỗi, tài khoản của bạn không đủ thỏi vàng để chuyển',
        );
      if (user.server !== target.server)
        throw new BadRequestException('Bạn và người nhận không chung Server');
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
      await this.handleCreateUserActive({
        uid: user.id,
        currentGold: user.gold,
        newGold: user.gold - data.amount,
        active: JSON.stringify({
          name: 'Trade',
          targetId: data.targetId,
          amount: data.amount,
        }),
      });
      await this.handleCreateUserActive({
        uid: target.id,
        currentGold: target.gold,
        newGold: target.gold + data.amount,
        active: JSON.stringify({
          name: 'Re-Trade',
          targetId: user.id,
          amount: data.amount,
        }),
      });
      const result = res.toObject();
      delete result.pwd_h;
      return {
        message: `Đã chuyển ${data.amount} Thỏi vàng cho ${target.name} thành công`,
        status: true,
        data: result,
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
      let gold = amount * (eventBankWithDraw?.value ?? 0.0062);
      if (target.vip < 1)
        throw new Error(`Xin lỗi, bạn phải đạt tối thiểu VIP 1 mới có thể rút`);
      if (old_order)
        throw new Error('Phiên trước chưa kết thúc, xin vui lòng kiểm tra lại');
      if (target.limitedTrade - gold < 0)
        throw new Error(`Xin lỗi, bạn đã rút vượt quá hạn mức quy định`);
      if (target.gold - gold < 0)
        return { message: 'Tài khoản không đủ số dư để thực hiện lệnh rút!' };

      await this.handleCreateUserActive({
        active: JSON.stringify({
          name: 'Tạo Rút BANK',
          amount: amount,
          gold: gold,
        }),
        uid: uid,
        currentGold: target.gold,
        newGold: target.gold - gold,
      });

      await this.userModel.findByIdAndUpdate(uid, {
        $inc: {
          gold: -gold,
        },
      });
      return await this.userWithDrawModel.create({ ...data, gold });
    } catch (err) {
      throw new BadRequestException(err.message);
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
  async handleUserBetLogs(limit: number, server: any, userId: any) {
    const query = userId ? { uid: userId } : { server: server };
    const data = await this.userBetModel
      .find(query)
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

  async handlerBulkCreateActive(data: any) {
    return await this.userActiveModel.insertMany(data);
  }

  //TODO ———————————————[Handle Vip]———————————————
  async handleCreateUserVip(data: CreateUserVip) {
    try {
      return await this.userVipModel.create(data);
    } catch (err) {}
  }

  async handleUpdateUserVip(uid: any, data: UpdateUserVip) {
    try {
      return await this.userVipModel
        .findOneAndUpdate({ uid }, data, { new: true, upsert: true })
        .exec();
    } catch (err) {}
  }

  async handleStopUserVip(data: StopUserVip) {
    try {
      return await this.userVipModel
        .findOneAndUpdate(
          { uid: data.uid },
          { isEnd: data.isEnd },
          { new: true, upsert: true },
        )
        .exec();
    } catch (err) {}
  }

  async handleFindUserVip(uid: any) {
    try {
      return await this.userVipModel.findOne({ uid });
    } catch (err) {}
  }

  async handleClaimVip(uid: any, date: any) {
    const parameter = `user-claim-vip`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const user = await this.userModel.findById(uid);
      const e_rule_vip_claim =
        await this.handleGetEventModel('e-rule-vip-claim');
      const e_value_vip_claim =
        await this.handleGetEventModel('e-value-vip-claim');
      const rule_value_claim = JSON.parse(e_rule_vip_claim.option);
      const value_claim = JSON.parse(e_value_vip_claim.option);
      const targetVip = await this.handleFindUserVip(user.id);
      if (!user) throw new Error('Không tìm thấy Người Chơi');
      if (!targetVip || user.vip === 0)
        throw new Error('Người chơi phải đạt ít nhất là VIP 1');
      const rule_value = rule_value_claim[user.vip - 1];
      if (user.totalBet < rule_value)
        throw new Error(
          `Tổng cược chơi hôm nay của bạn phải đạt ${rule_value} thỏi vàng mới được điểm danh VIP`,
        );
      const currentNow = moment().format('DD/MM/YYYY');
      const dateMoment = moment(date).format('DD/MM/YYYY');
      if (currentNow !== dateMoment)
        throw new Error('Bạn không thể điểm danh bù');
      const list_date = JSON.parse(targetVip.data);
      let new_data = [...list_date];
      const find_date_claim = new_data?.find(
        (d) => moment(d.date).format('DD/MM/YYYY') === dateMoment,
      );
      if (!find_date_claim)
        throw new Error(
          'Đã xảy ra lỗi khi điểm danh VIP, xin vui lòng liên hệ fanpage',
        );
      if (find_date_claim?.isClaim) throw new Error('Hôm nay bạn đã điểm danh');
      if (find_date_claim?.isNext)
        throw new Error('Bạn không thể điểm danh bù');
      const claim = value_claim[user.vip - 1];
      // Update claim VIP
      let indexClaimNow = new_data?.findIndex((d) => d.date === date);
      new_data[indexClaimNow] = {
        ...new_data[indexClaimNow],
        isClaim: true,
        isNext: true,
      };
      const newTargetVip = await this.userVipModel.findOneAndUpdate(
        { uid },
        {
          data: JSON.stringify(new_data),
        },
        { new: true, upsert: true },
      );

      // Update user claim
      const userTaget = await this.userModel.findByIdAndUpdate(
        uid,
        {
          $inc: {
            gold: +claim,
          },
        },
        { new: true, upsert: true },
      );

      await this.handleCreateUserActive({
        active: JSON.stringify({
          name: 'CLAIM VIP',
          value: claim,
        }),
        uid: uid,
        currentGold: user.gold,
        newGold: user.gold + claim,
      });

      let result_user = userTaget.toObject();
      delete result_user.pwd_h;
      return {
        message: `Bạn đã điểm danh thành công và được nhận ${claim} thỏi vàng từ VIP ${user.vip}`,
        data: {
          user: result_user,
          vip: newTargetVip,
        },
        status: 200,
      };
    } catch (err) {
      this.logger.log(`${err.message} - ${uid}`);
      throw new BadRequestException(err.message);
    } finally {
      release();
    }
  }

  handleGenVipClaim(timeStart: any, timeEnd: any) {
    try {
      let data = [];
      let start = moment(timeStart);
      let end = moment(timeEnd).endOf('day'); // Ensure end date includes the whole day

      while (start.isBefore(end)) {
        // Perform your actions with the current date
        data.push({
          date: moment(start),
          isClaim: false,
          isNext: false,
          isCancel: false,
        });

        // Increment the date by one day
        start.add(1, 'days');
      }

      // Perform actions for the last day if necessary
      if (start.isSame(end, 'day')) {
        data.push({
          date: moment(start),
          isClaim: false,
          isNext: false,
        });
      }

      // Do something with the data array
      return data;
    } catch (err) {}
  }

  async handleGetAllVip() {
    return await this.userVipModel.find();
  }

  findPosition(array: any, val: any) {
    for (let i = 0; i < array.length - 1; i++) {
      if (val >= array[i] && val < array[i + 1]) {
        return i;
      }
    }
    // Nếu giá trị lớn hơn tất cả các phần tử trong mảng
    if (val >= array[array.length - 1]) {
      return array.length - 1;
    }
    // Nếu giá trị nhỏ hơn tất cả các phần tử trong mảng
    // if (val < array[0]) {
    //   return 0;
    // }
    // Trường hợp giá trị không nằm trong phạm vi của mảng
    return -1;
  }

  //TODO ———————————————[Handle Mission]———————————————
  async handleClaimMission(data, claim: ClaimMission) {
    const parameter = `handleClaimMission`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const user = await this.findById(data.sub);
      const e_value_mission = await this.handleGetEventModel(
        'e-value-mission-daily',
      );
      const e_claim_mission = await this.handleGetEventModel(
        'e-claim-mission-daily',
      );
      const value_mission = JSON.parse(e_value_mission.option);
      const claim_mission = JSON.parse(e_claim_mission.option);
      const index = this.findPosition(value_mission, user.totalBet);
      if (index === -1)
        throw new BadRequestException('Bạn không đủ điểm để nhận quà');

      // Let find data mission
      let old_mission = await this.missionDailyModel.findOne({ uid: user.id });
      if (!old_mission) {
        let new_mission = await this.handleCreateDataMissionUser(user.id);
        old_mission = new_mission;
      }
      let data_misson = JSON.parse(old_mission.data);

      if (claim.index > index)
        throw new BadRequestException(
          'Bạn chưa đạt điều kiện để nhận phần thưởng này',
        );

      if (data_misson[claim.index]?.isClaim)
        throw new BadRequestException('Xin lỗi, phần thưởng này đã được nhận');

      data_misson[claim.index].isClaim = true;

      const res = await this.update(user.id, {
        $inc: {
          gold: +claim_mission[claim.index],
        },
      });
      const data_new_mission = await this.handleUpdateDataMissionUser(
        user.id,
        JSON.stringify(data_misson),
      );
      await this.handleCreateUserActive({
        uid: user.id,
        currentGold: user.gold,
        newGold: user.gold + claim_mission[claim.index],
        active: JSON.stringify({
          name: 'Claim Mission',
          value: claim.index + 1,
          gold: claim_mission[claim.index],
        }),
      });
      const result = res.toObject();
      delete result.pwd_h;
      return {
        message: `Chúc mừng bạn đã hoàn thành điểm danh với phần quà ${claim_mission[claim.index]} thỏi vàng`,
        status: true,
        data: result,
        mission: data_new_mission,
      };
    } catch (err) {
      throw new BadRequestException(err.message);
    } finally {
      release();
    }
  }

  async handleCreateDataMissionUser(uid: string) {
    try {
      let data = [];
      for (let i = 0; i < 7; i++) {
        data.push({ isClaim: false, step: i });
      }
      const res = await this.missionDailyModel.create({
        uid,
        data: JSON.stringify(data),
      });
      return res;
    } catch (err) {}
  }

  async handleUpdateDataMissionUser(uid: string, data: string) {
    try {
      return await this.missionDailyModel.findOneAndUpdate(
        { uid },
        { data },
        { new: true, upsert: true },
      );
    } catch (err) {}
  }

  async handleFindMissionUser(uid: any) {
    try {
      let mission = await this.missionDailyModel.findOne({ uid });
      if (!mission) {
        let new_mission = await this.handleCreateDataMissionUser(uid);
        mission = new_mission;
      }
      const result = mission.toObject();
      return result;
    } catch (err: any) {
      throw new BadRequestException(err?.message);
    }
  }

  async handleGetAllMissionData() {
    return await this.missionDailyModel.find();
  }

  //TODO ———————————————[Handler Top Bank]———————————————
  async updateTopBankWithUID(uid: string, data: any) {
    return await this.topBankModel.findOneAndUpdate({ uid: uid }, data, {
      new: true,
      upsert: true,
    });
  }

  async handleResetRankUser() {
    return await this.eventEmitter.emitAsync('rank-days', '');
  }
}
