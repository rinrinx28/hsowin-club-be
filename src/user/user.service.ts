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
  async handleExchangeGold(data: Exchange, token) {
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
}
