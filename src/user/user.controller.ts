import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateClans, CreateUserDto, MemberClans } from './dto/user.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/clans/create')
  async clansCreate(@Body() data: CreateClans) {
    return await this.userService.createClans(data);
  }

  @Post('/clans/join')
  async clansJoin(@Body() data: MemberClans) {
    const user = await this.userService.addMemberClans(data);
    delete user.pwd_h;
    return user;
  }

  @Post('/clans/leave')
  async clansLeave(@Body() data: MemberClans) {
    const user = await this.userService.removeMemberClans(data);
    delete user.pwd_h;
    return user;
  }

  @Post('/clans/delete')
  async clansDelete(@Body() data: MemberClans) {
    return await this.userService.deleteClanWithOwner(data);
  }

  @Get('/profile')
  getProfile(@Request() req: any) {
    const user: PayLoad = req.user;
    return user;
  }
}
