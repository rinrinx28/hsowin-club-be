import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { Session } from './schema/session.schema';
import { InjectModel } from '@nestjs/mongoose';
import { BankCreate, CreateSessionDto } from './dto/session.dto';
import { UserService } from 'src/user/user.service';
import { CronjobService } from 'src/cronjob/cronjob.service';
import { Bank } from './schema/bank.schema';
import apiClient from 'src/unitl/apiClient';
import * as moment from 'moment';
import * as crypto from 'crypto';
import { Event } from 'src/event/schema/event.schema';
import { CatchException } from 'src/common/common.exception';
import { UserWithDraw } from 'src/user/schema/userWithdraw';
import { Mutex } from 'async-mutex';
import { SocketGateway } from 'src/socket/socket.gateway';

@Injectable()
export class SessionService {
  private checksumKey = process.env.PAYOS_CHECKSUM_KEY; // Đảm bảo rằng biến môi trường này đã được cấu hình
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<Session>,
    @InjectModel(Bank.name)
    private readonly bankModel: Model<Bank>,
    @InjectModel(Event.name)
    private readonly eventModel: Model<Event>,
    @InjectModel(UserWithDraw.name)
    private readonly userWithDrawModel: Model<UserWithDraw>,
    private readonly userService: UserService,
    private readonly cronJobService: CronjobService,
    private readonly socketGateway: SocketGateway,
  ) {}

  private logger: Logger = new Logger('SessionService');
  private readonly mutexMap = new Map<string, Mutex>();

  async create(body: CreateSessionDto, user: PayLoad) {
    const { sub } = user;
    const parameter = `${sub}-session-create`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const e_auto_rut =
        await this.userService.handleGetEventModel('e-auto-rut-vang');
      const e_auto_nap =
        await this.userService.handleGetEventModel('e-auto-nap-vang');
      const e_min_withdraw = await this.userService.handleGetEventModel(
        'e-min-withdraw-gold',
      );
      const e_max_withdraw = await this.userService.handleGetEventModel(
        'e-max-withdraw-gold',
      );
      const e_min_deposit =
        await this.userService.handleGetEventModel('e-min-deposit-gold');

      if (body.type === '0' && !e_auto_nap.status)
        throw new Error(
          'Hệ thống nạp tự động đang tạm dừng, xin vui lòng liên hệ Fanpage',
        );
      if (body.type === '1' && !e_auto_rut.status)
        throw new Error(
          'Hệ thống rút tự động đang tạm dừng, xin vui lòng liên hệ Fanpage',
        );

      // Let find old session
      let old_session = await this.sessionModel
        .findOne({ uid: sub, status: '0' })
        .sort({ updatedAt: -1 })
        .exec();

      // old session has exist > return error BadRequest
      if (old_session)
        throw new Error(
          `Bạn vui lòng hoàn thành đơn ${body.type === '1' ? 'rút' : 'nạp'} trước đó!`,
        );

      const target = await this.userService.findById(body.uid);
      if (body.type === '1' && target.limitedTrade - body.amount < 0)
        throw new Error(`Xin lỗi, bạn đã rút vượt quá hạn mức quy định`);

      // Limited Amount
      if (body.type === '0' && body.amount < e_min_deposit.value)
        throw new Error(
          `Số thỏi vàng cần nạp phải lớn ${e_min_deposit.value} thỏi vàng`,
        );
      if (
        (body.type === '1' && body.amount > e_max_withdraw.value) ||
        (body.type === '1' && body.amount < e_min_withdraw.value)
      )
        throw new Error(
          `Số thỏi vàng cần rút phải lớn ${e_min_withdraw.value} và nhỏ hon ${e_max_withdraw.value} thỏi vàng`,
        );

      // Let minus gold of user
      if (body.type === '1') {
        if (target?.gold - body.amount < 0)
          throw new Error(
            'Số dư tài khoản của bạn hiện không đủ để thực hiện lệnh rút',
          );
        await this.userService.update(sub, {
          $inc: {
            gold: -body.amount,
            limitedTrade: -body.amount,
            trade: +body.amount,
          },
        });
      }

      const result = await this.sessionModel.create({
        ...body,
        status: '0',
        uid: body.uid,
        name: target.name, // Tên hiển thị
      });

      // Let Update Active
      if (body.type === '1') {
        await this.userService.handleCreateUserActive({
          uid: body.uid,
          active: JSON.stringify({
            name: 'Tạo Rút vàng',
            id: result.id,
          }),
          currentGold: target.gold,
          newGold: target.gold - body?.amount,
        });
      } else {
        await this.userService.handleCreateUserActive({
          uid: body.uid,
          active: JSON.stringify({
            name: 'Tạo nạp vàng',
            id: result.id,
          }),
          currentGold: target.gold,
          newGold: target.gold,
        });
      }
      // Let make auto cancel with timeout 600s = 10p
      const timeOutId = setTimeout(async () => {
        const service_cancel = await this.sessionModel.findByIdAndUpdate(
          result?.id,
          { status: '1' },
          { upsert: true, new: true },
        );
        if (result.type === '1') {
          await this.userService.update(sub, {
            $inc: {
              gold: +body.amount,
              limitedTrade: +body.amount,
              trade: -body.amount,
            },
          });
        }
        this.socketGateway.server.emit(
          'session-res',
          service_cancel.toObject(),
        );
        // remove task from memory storage
        this.cronJobService.remove(result?.id);
      }, 1e3 * 600); // 1e3 = 1000ms

      // send task to memory storage
      this.logger.log(
        `UID: ${sub} - ${body.type === '1' ? 'Rut' : 'Nạp'} - GOLD: ${body.amount}`,
      );
      this.cronJobService.create(result?.id, timeOutId);
      this.socketGateway.server.emit('session-ce', result.toObject());
      return result;
    } catch (err) {
      throw new CatchException(err);
    } finally {
      release();
    }
  }

  async findAllByUID(user: PayLoad) {
    const { sub } = user;
    try {
      const sessions = await this.sessionModel
        .find({ uid: sub })
        .sort({ updatedAt: -1 })
        .exec();
      return sessions;
    } catch (err) {
      throw new CatchException(err);
    }
  }

  async findByName(playerName: string) {
    try {
      const session = await this.sessionModel
        .findOne({ playerName, status: '0' })
        .sort({
          updatedAt: -1,
        })
        .exec();
      return session;
    } catch (err) {
      throw new CatchException(err);
    }
  }

  async findByID(id: string) {
    return await this.sessionModel.findById(id);
  }

  async updateById(id: string, data: any) {
    const result = await this.sessionModel.findByIdAndUpdate(id, data, {
      upsert: true,
      new: true,
    });
    this.cronJobService.remove(id);
    return result;
  }

  async findAllSesions(user: any) {
    return await this.sessionModel
      .find({ uid: user?.sub })
      .sort({ updatedAt: -1 });
  }

  async findSessionWithUser(page: number, limit: number, uid: string) {
    return await this.sessionModel
      .findOne({ uid: uid })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
  }

  //TODO ———————————————[Handle Banking]———————————————
  async handleCreateBank(data: BankCreate) {
    const parameter = `${data.uid}-banking-create`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const { amount, uid } = data;
      const eventOrderBank =
        await this.userService.handleGetEventModel('e-order-bank');
      const e_auto_bank =
        await this.userService.handleGetEventModel('e-auto-bank');
      if (!e_auto_bank.status)
        throw new Error('Xin lỗi bạn, hệ thống bank hiện tại đang bảo trì!');
      const old_order = await this.bankModel.findOne({ uid: uid, status: '0' });
      if (old_order)
        throw new Error('Bạn vui lòng hoàn thành đơn nạp trước đó!');
      let now = moment();
      let exp = now.add(15, 'minutes');
      const sign = {
        orderCode: eventOrderBank.value,
        amount: amount,
        description: `ORDER - ${data?.username}`,
        cancelUrl: 'https://hsgame.me/user',
        returnUrl: 'https://hsgame.me/user',
      };

      const signature = this.createSignature(sign);

      const body = {
        ...sign,
        items: [
          {
            name: 'Gói Tự Động',
            quantity: 1,
            price: amount,
          },
        ],
        expiredAt: moment(exp).unix(),
        signature: signature,
      };

      const res = await apiClient.post('/v2/payment-requests', body, {
        headers: {
          'x-client-id': process.env.PAYOS_CLIENT_ID,
          'x-api-key': process.env.PAYOS_API_KEY,
        },
      });

      const result = res.data;

      await this.bankModel.create({
        amount,
        uid,
        status: 0,
        orderId: result?.data.paymentLinkId,
      });

      await this.userService.handleUpdateEventModel('e-order-bank', {
        $inc: {
          value: +1,
        },
      });
      return result;
    } catch (err) {
      throw new CatchException(err);
    } finally {
      release();
    }
  }

  createSignature(data: { [key: string]: any }): string {
    // 1. Sort data theo alphabet
    const sortedData = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('&');

    // 2. Tạo HMAC_SHA256 signature
    const hmac = crypto.createHmac('sha256', this.checksumKey);
    hmac.update(sortedData);
    const signature = hmac.digest('hex');

    return signature;
  }

  async handleUpdateBank(id: string, status: string) {
    const eventExchangGold = await this.eventModel.findOne({
      name: 'e-bank-gold',
    });
    const e_value_diamom_claim = await this.eventModel.findOne({
      name: 'e-value-diamon-claim',
    });
    const bankInfo = await this.bankModel.findOneAndUpdate(
      { orderId: id },
      { status },
      { new: true, upsert: true },
    );

    if (status === '1') {
      const target = await this.userService.findById(bankInfo.uid);
      await this.userService.handleCreateUserActive({
        uid: bankInfo.uid,
        active: JSON.stringify({
          name: 'Nạp bank',
          id: bankInfo.id,
        }),
        currentGold: target.gold,
        newGold: target.gold + bankInfo.amount * eventExchangGold.value,
      });

      // Check vip
      const e_value_vip =
        await this.userService.handleGetEventModel('e-value-vip');
      const value_vip = JSON.parse(e_value_vip.option);
      const targetBank = target.totalBank + bankInfo.amount;
      // Find Level VIP 0 - 6 ( 1 - 7 )
      const targetVip = this.userService.findPosition(value_vip, targetBank);
      // Set Level VIP
      let start_data = moment();
      let end_data = moment().add(1, 'month');
      let data = this.userService.handleGenVipClaim(start_data, end_data);
      // Update Level VIP
      await this.userService.update(bankInfo.uid, {
        vip: targetVip + 1,
      });
      // Check OLD VIP in user
      if (target.vip !== 0) {
        await this.userService.handleCreateUserActive({
          uid: bankInfo.uid,
          active: JSON.stringify({
            name: 'VIP Upgrade',
            currentVip: target.vip,
            newVip: targetVip + 1,
          }),
          currentGold: target.gold,
          newGold: target.gold,
        });
      } else {
        // Check Old VIP in db
        const old_targetVip = await this.userService.handleFindUserVip(
          bankInfo.uid,
        );
        if (!old_targetVip) {
          // Create new VIP in db
          await this.userService.handleCreateUserVip({
            data: JSON.stringify(data),
            timeEnd: end_data,
            uid: bankInfo.uid,
          });
        } else {
          // Update VIP in db
          await this.userService.handleUpdateUserVip(bankInfo.uid, {
            data: JSON.stringify(data),
            timeEnd: end_data,
            isEnd: false,
          });
        }

        await this.userService.handleCreateUserActive({
          uid: bankInfo.uid,
          active: JSON.stringify({
            name: 'Set VIP',
            currentVip: target.vip,
            newVip: targetVip + 1,
          }),
          currentGold: target.gold,
          newGold: target.gold,
        });
      }

      await this.userService.update(bankInfo.uid, {
        $inc: {
          gold: +bankInfo.amount * eventExchangGold.value,
          totalBank: +bankInfo.amount,
          diamon: +e_value_diamom_claim.value * bankInfo.amount,
        },
      });
      await this.bankModel.findOneAndUpdate(
        { orderId: id },
        { revice: bankInfo.amount * eventExchangGold.value },
        { new: true, upsert: true },
      );
    }

    return true;
  }

  async handleBankLogUser(page = 1, limit = 10, uid) {
    return await this.bankModel
      .find({ uid })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
  }

  async handleBankLogUserRut(page = 1, limit = 10, uid) {
    return await this.userWithDrawModel
      .find({ uid })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
  }

  //TODO ———————————————[Handler Admin]———————————————
  async getListServicesV3({
    pageNumber,
    limitNumber,
    uid,
    server,
    playerName,
    type,
    startDate,
    endDate,
    sort,
  }: {
    pageNumber: number;
    limitNumber: number;
    uid: string;
    server: string;
    playerName: string;
    type: string;
    startDate: string;
    endDate: string;
    sort: {
      gold: 'asc' | 'desc' | 'all';
      trade: 'asc' | 'desc' | 'all';
    };
  }) {
    try {
      const query: any = {};

      // Thêm điều kiện filter nếu khác "all"
      if (server !== 'all') {
        query.server = server;
      }

      if (type !== 'all') {
        query.type = type;
      }

      if (startDate !== '' && endDate !== '') {
        query.createdAt = {
          $gte: new Date(`${startDate}T00:00:00Z`),
          $lt: new Date(`${endDate}T23:59:59Z`),
        };
      }

      if (uid !== '') {
        query.uid = uid;
      }

      if (playerName !== '') {
        query.playerName = { $regex: playerName };
      }
      // Chuẩn bị điều kiện sort
      const sortConditions: any = {};
      if (sort.gold !== 'all') {
        sortConditions.amount = sort.gold === 'asc' ? 1 : -1;
      }

      if (sort.trade !== 'all') {
        sortConditions.trade = sort.trade === 'asc' ? 1 : -1;
      }

      if (sort.gold === 'all' && sort.trade === 'all') {
        sortConditions.createdAt = -1;
      }
      const startIndex = (pageNumber - 1) * limitNumber;
      // Thực hiện truy vấn với lọc và sắp xếp
      const services = await this.sessionModel
        .find(query)
        .sort(sortConditions)
        .limit(limitNumber)
        .skip(startIndex)
        .exec();

      const count = await this.sessionModel.countDocuments(query);
      const totalPage = Math.ceil(count / limitNumber);

      return {
        page: pageNumber,
        limit: limitNumber,
        total: count,
        totalPage: totalPage,
        data: services,
      };
    } catch (err: any) {
      return {
        page: pageNumber,
        limit: limitNumber,
        total: 0,
        totalPage: 0,
        data: [],
        error: err.message,
      };
    }
  }

  async v3Create(body: CreateSessionDto) {
    const { name } = body;
    const parameter = `admin-session-create`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const e_auto_rut =
        await this.userService.handleGetEventModel('e-auto-rut-vang');
      const e_auto_nap =
        await this.userService.handleGetEventModel('e-auto-nap-vang');
      const e_min_withdraw = await this.userService.handleGetEventModel(
        'e-min-withdraw-gold',
      );
      const e_max_withdraw = await this.userService.handleGetEventModel(
        'e-max-withdraw-gold',
      );
      const e_min_deposit =
        await this.userService.handleGetEventModel('e-min-deposit-gold');

      if (body.type === '0' && !e_auto_nap.status)
        throw new Error(
          'Hệ thống nạp tự động đang tạm dừng, xin vui lòng liên hệ Fanpage',
        );
      if (body.type === '1' && !e_auto_rut.status)
        throw new Error(
          'Hệ thống rút tự động đang tạm dừng, xin vui lòng liên hệ Fanpage',
        );

      const target = await this.userService.findOneName(name);
      if (body.type === '1' && target.limitedTrade - body.amount < 0)
        throw new Error(`Xin lỗi, bạn đã rút vượt quá hạn mức quy định`);

      // Let find old session
      let old_session = await this.sessionModel
        .findOne({ uid: target.id, status: '0' })
        .sort({ updatedAt: -1 })
        .exec();

      // old session has exist > return error BadRequest
      if (old_session)
        throw new Error(
          `Bạn vui lòng hoàn thành đơn ${body.type === '1' ? 'rút' : 'nạp'} trước đó!`,
        );

      // Limited Amount
      if (body.type === '0' && body.amount < e_min_deposit.value)
        throw new Error(
          `Số thỏi vàng cần nạp phải lớn ${e_min_deposit.value} thỏi vàng`,
        );
      if (
        (body.type === '1' && body.amount > e_max_withdraw.value) ||
        (body.type === '1' && body.amount < e_min_withdraw.value)
      )
        throw new Error(
          `Số thỏi vàng cần rút phải lớn ${e_min_withdraw.value} và nhỏ hon ${e_max_withdraw.value} thỏi vàng`,
        );

      // Let minus gold of user
      if (body.type === '1') {
        if (target?.gold - body.amount < 0)
          throw new Error(
            'Số dư tài khoản của bạn hiện không đủ để thực hiện lệnh rút',
          );
        await this.userService.update(target.id, {
          $inc: {
            gold: -body.amount,
            limitedTrade: -body.amount,
            trade: +body.amount,
          },
        });
      }

      const result = await this.sessionModel.create({
        ...body,
        status: '0',
        uid: body.uid,
      });

      // Let Update Active
      if (body.type === '1') {
        await this.userService.handleCreateUserActive({
          uid: body.uid,
          active: JSON.stringify({
            name: 'Tạo Rút vàng',
            id: result.id,
          }),
          currentGold: target.gold,
          newGold: target.gold - body?.amount,
        });
      } else {
        await this.userService.handleCreateUserActive({
          uid: body.uid,
          active: JSON.stringify({
            name: 'Tạo nạp vàng',
            id: result.id,
          }),
          currentGold: target.gold,
          newGold: target.gold,
        });
      }
      // Let make auto cancel with timeout 600s = 10p
      const timeOutId = setTimeout(async () => {
        const service_cancel = await this.sessionModel.findByIdAndUpdate(
          result?.id,
          { status: '1' },
          { upsert: true, new: true },
        );
        if (result.type === '1') {
          await this.userService.update(target.id, {
            $inc: {
              gold: +body.amount,
              limitedTrade: +body.amount,
              trade: -body.amount,
            },
          });
        }
        this.socketGateway.server.emit(
          'session-res',
          service_cancel.toObject(),
        );
        // remove task from memory storage
        this.cronJobService.remove(result?.id);
      }, 1e3 * 600); // 1e3 = 1000ms

      // send task to memory storage
      this.logger.log(
        `[Admin] UID: ${target.id} - ${body.type === '1' ? 'Rut' : 'Nạp'} - GOLD: ${body.amount}`,
      );
      this.cronJobService.create(result?.id, timeOutId);
      this.socketGateway.server.emit('session-ce', result.toObject());
      return 'ok';
    } catch (err) {
      throw new CatchException(err);
    } finally {
      release();
    }
  }

  // Lấy dữ liệu nhóm theo ngày/tháng/năm
  async getDashboardData(type: string) {
    let groupByFormat;

    // Xác định format nhóm theo ngày/tháng/năm
    switch (type) {
      case 'month':
        groupByFormat = {
          $dateToString: { format: '%Y-%m', date: '$createdAt' },
        }; // YYYY-MM
        break;
      case 'year':
        groupByFormat = { $dateToString: { format: '%Y', date: '$createdAt' } }; // YYYY
        break;
      default:
        groupByFormat = {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        }; // YYYY-MM-DD
    }

    return this.sessionModel.aggregate([
      {
        $group: {
          _id: {
            date: groupByFormat, // Nhóm theo thời gian
            type: '$type', // Nhóm riêng theo type (Nạp/Rút)
          },
          totalRecive: { $sum: '$recive' }, // Tổng số tiền nhận
          totalTransactions: { $count: {} }, // Tổng số giao dịch
        },
      },
      {
        $group: {
          _id: '$_id.date', // Nhóm lại theo thời gian
          types: {
            $push: {
              type: '$_id.type', // Type (Nạp/Rút)
              totalRecive: '$totalRecive', // Tổng số tiền theo type
              totalTransactions: '$totalTransactions', // Tổng số giao dịch theo type
            },
          },
        },
      },
      { $sort: { _id: 1 } }, // Sắp xếp theo thời gian
    ]);
  }

  async getGoldDataByRange(from: Date, to: Date) {
    return this.sessionModel.aggregate([
      // Chuẩn hóa ngày (bỏ giờ)
      {
        $addFields: {
          dateOnly: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
        },
      },
      // Lọc theo khoảng ngày
      {
        $match: {
          dateOnly: {
            $gte: from.toISOString().split('T')[0],
            $lte: to.toISOString().split('T')[0],
          },
        },
      },
      // Gom nhóm theo ngày
      {
        $group: {
          _id: {
            date: '$dateOnly',
            type: '$type',
          },
          totalRecive: { $sum: '$recive' },
          totalTransactions: { $count: {} },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          types: {
            $push: {
              type: '$_id.type',
              totalRecive: '$totalRecive',
              totalTransactions: '$totalTransactions',
            },
          },
        },
      },
      // Sắp xếp theo ngày tăng dần
      { $sort: { _id: 1 } },
    ]);
  }
}
