import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
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
  ) {}
  async create(body: CreateSessionDto, user: PayLoad) {
    const { sub } = user;
    try {
      // Limited Amount
      if (body.type === '0' && body.amount < 30)
        throw new Error('Số thỏi vàng cần nạp phải lớn 30 thỏi vàng');
      if (
        (body.type === '1' && body.amount > 300) ||
        (body.type === '1' && body.amount < 30)
      )
        throw new Error(
          'Số thỏi vàng cần rút phải lớn 30 và nhỏ hon 300 thỏi vàng',
        );

      // Let minus gold of user
      if (body.type === '1') {
        const target = await this.userService.findOne(user.username);
        if (target?.gold - body.amount <= 0)
          throw new Error(
            'Số dư tài khoản của bạn hiện không đủ để thực hiện lệnh rút',
          );
        await this.userService.update(sub, { $inc: { gold: -body.amount } });
      }
      // Let find old session
      let old_session = await this.sessionModel
        .findOne({ uid: sub, status: '0' })
        .sort({ updatedAt: -1 })
        .exec();
      // old session has exist > return error BadRequest
      if (old_session)
        throw new Error('Phiên trước chưa kết thúc, xin vui lòng kiểm tra lại');
      const result = await this.sessionModel.create({
        ...body,
        status: '0',
        uid: body.uid,
      });
      // Let make auto cancel with timeout 600s = 10p
      const timeOutId = setTimeout(async () => {
        await this.sessionModel.findByIdAndUpdate(
          result?.id,
          { status: '1' },
          { upsert: true },
        );
        if (result.type === '1') {
          await this.userService.update(sub, { $inc: { gold: +body.amount } });
        }
        // remove task from memory storage
        this.cronJobService.remove(result?.id);
      }, 1e3 * 600); // 1e3 = 1000ms
      // send task to memory storage
      this.cronJobService.create(result?.id, timeOutId);
      return result;
    } catch (err) {
      throw new CatchException(err);
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
    if (data?.status === '2') {
      this.cronJobService.remove(id);
    }
    const result = await this.sessionModel.findByIdAndUpdate(id, data, {
      upsert: true,
      new: true,
    });
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
    try {
      const { amount, uid } = data;
      const eventOrderBank =
        await this.userService.handleGetEventModel('e-order-bank');
      let now = moment();
      let exp = now.add(15, 'minutes');
      const sign = {
        orderCode: eventOrderBank.value,
        amount: amount,
        description: 'Thanh toan don hang',
        cancelUrl: 'https://hsowin.vip/user',
        returnUrl: 'https://hsowin.vip/user',
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
      console.log(err);
      throw new CatchException(err);
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
    const bankInfo = await this.bankModel.findOneAndUpdate(
      { orderId: id },
      { status },
      { new: true, upsert: true },
    );

    if (status === '1') {
      await this.userService.update(bankInfo.uid, {
        $inc: {
          gold: +bankInfo.amount * eventExchangGold.value,
        },
      });
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
}
