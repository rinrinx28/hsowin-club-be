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
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  CreateClans,
  CreateUserDto,
  Exchange,
  MemberClans,
  SetVip,
  UserBankWithDraw,
  UserTrade,
} from './dto/user.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { CreateEvent } from 'src/event/dto/event.dto';
import * as moment from 'moment';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  //TODO ———————————————[Path Clans]———————————————
  @UseGuards(AuthGuard)
  @Post('/clans/create')
  async clansCreate(@Body() data: CreateClans) {
    return await this.userService.createClans(data);
  }

  @UseGuards(AuthGuard)
  @Post('/clans/join')
  async clansJoin(@Body() data: MemberClans) {
    const user = await this.userService.addMemberClans(data);
    delete user.pwd_h;
    return user;
  }

  @UseGuards(AuthGuard)
  @Post('/clans/leave')
  async clansLeave(@Body() data: MemberClans) {
    const user = await this.userService.removeMemberClans(data);
    delete user.pwd_h;
    return user;
  }

  @UseGuards(AuthGuard)
  @Post('/clans/delete')
  async clansDelete(@Body() data: MemberClans) {
    return await this.userService.deleteClanWithOwner(data);
  }

  //TODO ———————————————[Path Info]———————————————

  @UseGuards(AuthGuard)
  @Get('/profile')
  getProfile(@Request() req: any) {
    const user: PayLoad = req.user;
    return user;
  }

  //TODO ———————————————[Path Event]———————————————

  @UseGuards(AuthGuard)
  @Post('/create-event')
  async handleCreateEventModel(@Body() data: CreateEvent) {
    return await this.userService.handleCreateEventModel(data);
  }

  @UseGuards(AuthGuard)
  @Get('/events')
  async getEvents() {
    return await this.userService.handleGetEventModels({});
  }

  //TODO ———————————————[Exchange]———————————————
  @UseGuards(AuthGuard)
  @Post('/exchange-gold')
  async handleExchangeGold(@Body() data: Exchange, @Request() req: any) {
    return await this.userService.handleExchangeGold(data, req.user);
  }

  //TODO ———————————————[Admin Controller]———————————————
  @UseGuards(AuthGuard)
  @Get('/all/users')
  async handleGetUser() {
    return await this.userService.handleGetAllUser();
  }

  @UseGuards(AuthGuard)
  @Get('/all/users/bet')
  async handleGetUserBet() {
    return await this.userService.handleGetAllUserbet();
  }

  @Get('/rank')
  async handleUserRank() {
    return await this.userService.handleUserRank();
  }

  //TODO ———————————————[User bank and trade]———————————————

  @Post('/trade')
  async handleUserTrade(@Body() data: UserTrade) {
    return await this.userService.handleUserTrade(data);
  }

  @Post('/bank/withdraw')
  async handleUserBankWithdraw(@Body() data: UserBankWithDraw) {
    return await this.userService.handleUserBankWithdraw(data);
  }

  //TODO ———————————————[Bet Log User]———————————————

  @Get('/log-bet/all')
  async handleUserBetLogs(
    @Query('limit') limit: any,
    @Query('server') server: any,
  ) {
    return await this.userService.handleUserBetLogs(limit, server);
  }

  @Get('/bets/log')
  @UseGuards(AuthGuard)
  async handleUserBetLog(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: any,
  ) {
    const user = req.user;
    return await this.userService.handleUserBetLog(page, limit, user.sub);
  }

  // @Get('/admin/add/data')
  // async handleData() {
  //   return await this.userService.handleData();
  // }

  //TODO ———————————————[Get Event Config]———————————————
  @Get('/config')
  async handleUserEventConfig() {
    return await this.userService.handleGetEventModels({});
  }

  //TODO ———————————————[Handle VIP Claim]———————————————
  @Post('/vip/claim')
  @UseGuards(AuthGuard)
  async handleClaimVip(@Req() req: any, @Body() data: any) {
    const user = req.user;
    const now = moment();
    const date = data.date;
    if (now.isBefore(moment(date)))
      throw new BadRequestException(
        'Xin lỗi bạn không thể điểm danh cho ngày khác',
      );
    return await this.userService.handleClaimVip(user.sub, date);
  }

  @Get('/vip/info')
  @UseGuards(AuthGuard)
  async handleGetUserInfoVip(@Req() req: any) {
    const user = req.user;
    const targetVip = await this.userService.handleFindUserVip(user.sub);
    return targetVip ?? {};
  }

  //TODO ———————————————[Handle Test API]———————————————
  @Post('/set/vip')
  async handleGenVipClaim(@Body() data: SetVip) {
    // Check vip
    const e_value_vip =
      await this.userService.handleGetEventModel('e-value-vip');
    const value_vip = JSON.parse(e_value_vip.option);
    for (const vip of data.data) {
      const targetBank = vip.totalBank;
      // Find Level VIP 0 - 6 ( 1 - 7 )
      const targetVip = this.userService.findPosition(value_vip, targetBank);
      // Set Level VIP
      let start_data = moment();
      let end_data = moment().add(29, 'days');
      let data_vip = this.userService.handleGenVipClaim(start_data, end_data);

      let targetUser = await this.userService.findById(vip.uid);
      if (targetUser) {
        // Update Level VIP
        await this.userService.update(vip.uid, {
          vip: targetVip + 1,
          totalBank: targetBank,
        });

        // Check Old VIP in db
        if (targetVip + 1 > 0) {
          const old_targetVip = await this.userService.handleFindUserVip(
            vip.uid,
          );
          if (!old_targetVip) {
            // Create new VIP in db
            await this.userService.handleCreateUserVip({
              data: JSON.stringify(data_vip),
              timeEnd: end_data,
              uid: vip.uid,
            });
          } else {
            // Update VIP in db
            await this.userService.handleUpdateUserVip(vip.uid, {
              data: JSON.stringify(data_vip),
              timeEnd: end_data,
              isEnd: false,
            });
          }
        }
      }
    }
    return 'ok';
  }
}
