import {
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

@Injectable()
export class SessionService {
  private orderCount = 10012;
  private checksumKey = process.env.PAYOS_CHECKSUM_KEY; // Đảm bảo rằng biến môi trường này đã được cấu hình
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<Session>,
    @InjectModel(Bank.name)
    private readonly bankModel: Model<Bank>,
    @InjectModel(Event.name)
    private readonly eventModel: Model<Event>,
    private readonly userService: UserService,
    private readonly cronJobService: CronjobService,
  ) {}
  async create(body: CreateSessionDto, user: PayLoad) {
    const { sub } = user;
    try {
      // Limited Amount
      if (body.amount < 30) throw new Error('The Min Amount is 30 gold');
      // Let minus gold of user
      if (body.type === '1') {
        const target = await this.userService.findOne(user.username);
        if (target?.gold - body.amount <= 0)
          throw new Error(
            'The balance is not enough to make the withdrawal order',
          );
        await this.userService.update(sub, { $inc: { gold: -body.amount } });
      }
      // Let find old session
      let old_session = await this.sessionModel
        .findOne({ uid: sub, status: '0' })
        .sort({ updatedAt: -1 })
        .exec();
      // old session has exist > return error BadRequest
      if (old_session) throw new Error('The old session has exist');
      const result = await this.sessionModel.create({
        ...body,
        status: '0',
        uid: sub,
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
      throw new BadRequestException(err.message);
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
      throw new ForbiddenException();
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
      throw new BadRequestException();
    }
  }

  async updateById(id: string, data: any) {
    const result = await this.sessionModel.findByIdAndUpdate(id, data, {
      upsert: true,
    });
    return result;
  }

  async findAllSesions() {
    return await this.sessionModel.find();
  }

  //TODO ———————————————[Handle Banking]———————————————
  async handleCreateBank(data: BankCreate) {
    try {
      const { amount, uid } = data;
      let now = moment();
      let exp = now.add(15, 'minute');
      const sign = {
        orderCode: this.orderCount,
        amount: amount,
        description: 'Thanh toan don hang',
        cancelUrl: 'http://localhost:3000/user',
        returnUrl: 'http://localhost:3000/user',
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

      await this.bankModel.create({
        amount,
        uid,
        status: 0,
        orderId: res.data?.data.paymentLinkId,
      });
      this.orderCount++;
      return res.data;
    } catch (err) {
      console.log(err);
      throw new BadRequestException('Đã Xảy Ra Lỗi');
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

    await this.userService.update(bankInfo.uid, {
      $inc: {
        gold: +bankInfo.amount * eventExchangGold.value,
      },
    });
    return true;
  }
}
