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
import {
  CreateClans,
  CreateUserDto,
  Exchange,
  MemberClans,
} from './dto/user.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { CreateEvent } from 'src/event/dto/event.dto';

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  //TODO ———————————————[Path Clans]———————————————
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

  //TODO ———————————————[Path Info]———————————————

  @Get('/profile')
  getProfile(@Request() req: any) {
    const user: PayLoad = req.user;
    return user;
  }

  //TODO ———————————————[Path Event]———————————————

  @Post('/create-event')
  async handleCreateEventModel(@Body() data: CreateEvent) {
    return await this.userService.handleCreateEventModel(data);
  }

  @Get('/events')
  async getEvents() {
    return await this.userService.handleGetEventModels({});
  }

  //TODO ———————————————[Exchange]———————————————
  @Post('/exchange-gold')
  async handleExchangeGold(@Body() data: Exchange, @Request() req: any) {
    return await this.userService.handleExchangeGold(data, req.user);
  }
}
