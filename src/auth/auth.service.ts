import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { CreateAuthDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async signIn(username: string, pass: string) {
    const user = await this.userService.findOne(username);
    if (user?.pwd_h !== pass) {
      throw new UnauthorizedException('Username hoặc password không đúng');
    }
    const payload = { sub: user.id, username: user.username };
    const { pwd_h, ...res } = user;
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
}
