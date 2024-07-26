import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { CreateAuthDto } from './dto/auth.dto';
import { jwtConstants } from './constants';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async signIn(username: string, pass: string) {
    const user = await this.userService.findOne(username);
    if (!user || user.pwd_h !== pass) {
      throw new UnauthorizedException('Username hoặc password không đúng');
    }
    const payload = { sub: user.id, username: user.username };
    const userObj = user.toObject(); // Convert Mongoose document to plain object
    const { pwd_h, ...res } = userObj;
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: res,
    };
  }

  async signUp(body: CreateAuthDto) {
    const result = await this.userService.create(body);
    delete result.pwd_h;
    return result;
  }

  async relogin(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });
      const user = await this.userService.findById(payload?.sub);
      delete user.pwd_h;
      return user;
    } catch (err) {
      throw new UnauthorizedException('Token không khớp');
    }
  }
}
