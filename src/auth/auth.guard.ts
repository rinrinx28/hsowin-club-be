import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import {
  IS_ADMIN_KEY,
  IS_PUBLIC_KEY,
  IS_USER_KEY,
} from './decorators/public.decorator';
import { UserService } from 'src/user/user.service';
import { jwtConstants } from './constants';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const isPublic = this.reflector.get<boolean>(
        IS_PUBLIC_KEY,
        context.getHandler(),
      );
      const isUser = this.reflector.get<boolean>(
        IS_USER_KEY,
        context.getHandler(),
      );

      const isAdmin = this.reflector.get<boolean>(
        IS_ADMIN_KEY,
        context.getHandler(),
      );
      if (isPublic) return true;

      const token = this.extractTokenFromHeader(request);
      if (!token)
        throw new BadRequestException(
          'Mã thông báo xác thực không hợp lệ hoặc đã hết hạn',
        );

      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });
      request['user'] = payload;

      const user = await this.userService.findById(payload?.sub);
      if (!user) throw new ForbiddenException('Không tìm thấy người dùng');

      if (user.isBan)
        throw new BadRequestException(`Người dùng bị cấm: ${user.isReason}`);

      if (!isUser && !isAdmin) return true;

      // Check path user
      if (isUser && ['0', '1'].includes(user.type)) return true;
      // check path admin
      if (isAdmin && ['1'].includes(user.type)) return true;

      throw new ForbiddenException('Quyền của bạn không đủ');
    } catch (err) {
      throw new BadRequestException(
        'Mã thông báo xác thực không hợp lệ hoặc đã hết hạn',
      );
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
