import { Injectable, UnauthorizedException } from '@nestjs/common';
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

  async signIn(username: string, pass: string, req: any) {
    const ip = req.headers['x-real-ip'];
    const user = await this.userService.findOne(username);
    if (!user || user.pwd_h !== pass) {
      throw new UnauthorizedException('Username hoặc password không đúng');
    }
    // await this.userService.handleUserUpdateIp()
    const payload = { sub: user.id, username: user.username };
    const userObj = user.toObject(); // Convert Mongoose document to plain object
    const { pwd_h, ...res } = userObj;
    if (userObj.isBan) throw Error('Tài khoản đã bị banned');
    const access_token = await this.jwtService.signAsync(payload);
    await this.autTokenhModel.create({ token: access_token, isEnd: false });
    await this.userService.handleUserUpdateIp(ip, user.id);
    await this.userService.handleAddIp(user.id, ip);
    return {
      access_token: access_token,
      user: res,
    };
  }

  async signUp(body: CreateAuthDto, req: any) {
    const ip = req.headers['x-real-ip'];
    const result = await this.userService.create(body);
    await this.userService.handleUserUpdateIp(ip, result.id);
    await this.userService.handleAddIp(result.id, ip);
    delete result.pwd_h;
    return result;
  }

  async relogin(token: string, req: any) {
    const ip = req.headers['x-real-ip'];
    try {
      const user = await this.userService.findById(token?.sub);
      const new_date = user.toObject();
      await this.userService.handleUserUpdateIp(ip, token?.sub);
      await this.userService.handleAddIp(token?.sub, ip);
      if (new_date.isBan) throw Error('Tài khoản đã bị banned');
      delete new_date.pwd_h;
      return new_date;
    } catch (err) {
      throw new UnauthorizedException('Token không khớp');
    }
  }
}
