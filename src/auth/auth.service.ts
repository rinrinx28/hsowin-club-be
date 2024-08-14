import {
  BadGatewayException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { CreateAuthDto } from './dto/auth.dto';
import { jwtConstants } from './constants';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthToken } from './schema/auth.schema';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    @InjectModel(AuthToken.name)
    private readonly autTokenhModel: Model<AuthToken>,
  ) {}

  private logger: Logger = new Logger('AuthService');

  async signIn(username: string, pass: string, req: any) {
    try {
      const ip_address = req.headers['x-real-ip'];
      const user = await this.userService.findOne(username);
      if (!user || user.pwd_h !== pass) {
        throw new UnauthorizedException('Username hoặc password không đúng');
      }
      // await this.userService.handleUserUpdateIp()
      const payload = { sub: user.id, username: user.username };
      const userObj = user.toObject(); // Convert Mongoose document to plain object
      const { pwd_h, ...res } = userObj;
      if (userObj.isBan)
        throw Error(`Tài khoản đã bị banned\n${userObj?.isReason}`);

      const targetIp = await this.userService.handleUserWithIp(ip_address);
      if (
        targetIp &&
        !targetIp.countAccount.includes(user.id) &&
        targetIp.countAccount.length > 1
      )
        throw new UnauthorizedException(
          'Nghi vấn spam, bạn không thể đăng nhập thêm tài khoản ở trên thiết bị này',
        );
      // Check old access_token
      const old_token = await this.autTokenhModel.findOne({ uid: user.id });
      const access_token =
        old_token?.token || (await this.jwtService.signAsync(payload));
      await this.autTokenhModel.create({
        token: access_token,
        isEnd: false,
        uid: user.id,
      });
      await this.userService.handleUserUpdateIp(user.id, ip_address);
      await this.userService.handleAddIp(user.id, ip_address);
      this.logger.log(`[Login] UID:${user.id} - IP:${ip_address}`);
      return {
        access_token: access_token,
        user: res,
      };
    } catch (err) {
      throw new BadGatewayException(err.message);
    }
  }

  async signUp(body: CreateAuthDto, req: any) {
    try {
      const ip_address = req.headers['x-real-ip'];
      const targetIp = await this.userService.handleUserWithIp(ip_address);
      if (targetIp && targetIp.countAccount.length > 1)
        throw new UnauthorizedException(
          'Nghi vấn spam, bạn không thể tạo thêm tài khoản ở trên thiết bị này',
        );
      const result = await this.userService.create(body);
      this.logger.log(`[Register] UID:${result.id} - IP:${ip_address}`);
      delete result.pwd_h;
      return result;
    } catch (err) {
      throw new BadGatewayException(err.message);
    }
  }

  async relogin(token: string, req: any) {
    const ip_address = req.headers['x-real-ip'];
    this.logger.log(`[Relogin] UID:${token?.sub} - IP:${ip_address}`);
    try {
      const user = await this.userService.findById(token?.sub);
      const new_date = user.toObject();
      if (new_date.isBan)
        throw Error(`Tài khoản đã bị banned\n${new_date?.isReason}`);
      const targetIp = await this.userService.handleUserWithIp(ip_address);
      if (
        targetIp &&
        !targetIp.countAccount.includes(user.id) &&
        targetIp.countAccount.length > 1
      )
        throw new UnauthorizedException(
          'Nghi vấn spam, bạn không thể đăng nhập thêm tài khoản ở trên thiết bị này',
        );
      await this.userService.handleUserUpdateIp(token?.sub, ip_address);
      await this.userService.handleAddIp(token?.sub, ip_address);
      delete new_date.pwd_h;
      return new_date;
    } catch (err) {
      throw new UnauthorizedException(err.message);
    }
  }
}
