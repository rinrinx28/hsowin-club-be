import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { Session } from './schema/session.schema';
import { InjectModel } from '@nestjs/mongoose';
import { CreateSessionDto } from './dto/session.dto';
import { UserService } from 'src/user/user.service';
import { CronjobService } from 'src/cronjob/cronjob.service';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<Session>,
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
}
