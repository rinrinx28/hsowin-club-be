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
  ChangePassword,
  ClaimMission,
  CreateClans,
  CreateUserDto,
  Exchange,
  MemberClans,
  SetVip,
  UserBankWithDraw,
  UserTrade,
} from './dto/user.dto';
import { CreateEvent } from 'src/event/dto/event.dto';
import * as moment from 'moment';
import { isUser, isAdmin, Public } from 'src/auth/decorators/public.decorator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateUserBet } from 'src/socket/dto/socket.dto';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private eventEmitter: EventEmitter2,
  ) {}

  //TODO ———————————————[User Password]———————————————

  @Post('/change-password')
  @isUser()
  async changePassword(@Req() req: any, @Body() data: ChangePassword) {
    const user = req.user;
    const target = await this.userService.findById(user.sub);
    if (target.pwd_h !== data.old_pwd)
      throw new BadRequestException(
        'Mật khẩu cũ không đúng, xin vui lòng kiểm tra lại!',
      );
    await this.userService.update(user?.sub, {
      pwd_h: data.new_pwd,
    });
    return 'Bạn đã đổi mật khẩu thành công';
  }

  //TODO ———————————————[Path Clans]———————————————

  @Post('/clans/create')
  @isUser()
  async clansCreate(@Body() data: CreateClans, @Req() req: any) {
    const user = req.user;
    if (data.ownerId !== user.sub)
      throw new BadRequestException(
        'Bạn đã bị từ chối dịch vụ, vì bạn không phải chủ nhân của Token!',
      );

    return await this.userService.createClans(data);
  }

  @Post('/clans/join')
  @isUser()
  async clansJoin(@Body() data: MemberClans) {
    const user = await this.userService.addMemberClans(data);
    return user;
  }

  @Post('/clans/leave')
  @isUser()
  async clansLeave(@Body() data: MemberClans, @Req() req: any) {
    const owner = req.user;
    if (owner.sub !== data.uid)
      throw new BadRequestException(
        'Bạn đã bị từ chối dịch vụ, vì bạn không phải chủ nhân của Token!',
      );
    const user = await this.userService.removeMemberClans(data);
    return user;
  }

  @Post('/clans/delete')
  @isUser()
  async clansDelete(@Body() data: MemberClans, @Req() req: any) {
    const owner = req.user;
    if (data.uid !== owner.sub)
      throw new BadRequestException(
        'Bạn đã bị từ chối dịch vụ, vì bạn không phải chủ nhân của Token!',
      );
    return await this.userService.deleteClanWithOwner(data);
  }

  @Get('/clans')
  @Public()
  async clansGet() {
    return await this.userService.clansGet({});
  }

  @Get('/clans/info/:id')
  @Public()
  async clansInfo(@Param('id') id: any) {
    return await this.userService.clansInfo(id);
  }

  //TODO ———————————————[Handler Clan Owner]———————————————
  @Post('/clans/kick')
  @isUser()
  async clanKick(@Req() req: any, @Body() data: any) {
    try {
      const owner = req.user;
      const { clanId, userId } = data;
      const isOwner = await this.userService.handlerClanOwner({
        userId: owner.sub,
        clanId: clanId,
      });
      if (!isOwner) throw new Error('Bạn không phải chủ Bang Hội!');
      const user = await this.userService.removeMemberClans({
        clanId: clanId,
        uid: userId,
      });
      return user;
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  //TODO ———————————————[Handler Clan Penning Owner]———————————————
  @Get('/clans/pening/list/:id')
  @isUser()
  async clanPeningList(@Req() req: any, @Param('id') id: string) {
    try {
      const user = req.user;
      const isOwner = await this.userService.handlerClanOwner({
        userId: user.sub,
        clanId: id,
      });
      if (!isOwner) throw new Error('Bạn không phải chủ Bang hội!');
      const list_penning = await this.userService.handlerGetPenningClans(id);
      return {
        status: true,
        data: list_penning,
        message: 'Dữ liệu đã được gửi!',
      };
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post('/clans/pening/acpect')
  @isUser()
  async clanPeningAcpect(@Req() req: any, @Body() data: any) {
    try {
      const { id, clanId } = data;
      const owner = req.user;
      const isOwner = await this.userService.handlerClanOwner({
        clanId: clanId,
        userId: owner.sub,
      });
      if (!isOwner) throw new Error('Bạn không phải chủ Bang Hội!');
      return await this.userService.handleAcpectUserJoinClans(id);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post('/clans/pening/decline')
  @isUser()
  async clanPenningDecline(@Req() req: any, @Body() data: any) {
    try {
      const { id, clanId } = data;
      const owner = req.user;
      const isOwner = await this.userService.handlerClanOwner({
        clanId: clanId,
        userId: owner.sub,
      });
      if (!isOwner) throw new Error('Bạn không phải chủ Bang Hội!');
      return await this.userService.handlerDeclineUserJoinClans(id);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  @Post('/clans/update')
  @isUser()
  async clanUpdate(
    @Req() req: any,
    @Body() body: { type: 'des' | 'type'; data: string; clanId: string },
  ) {
    try {
      const { clanId, data, type } = body;
      const owner = req.user;
      const isOwner = await this.userService.handlerClanOwner({
        clanId: clanId,
        userId: owner.sub,
      });
      if (!isOwner) throw new Error('Bạn không phải chủ Bang Hội!');
      return await this.userService.handlerUpdateClan({
        type,
        clanId,
        data,
        uid: owner.sub,
      });
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  //TODO ———————————————[Path Info]———————————————

  @Get('/profile')
  @isUser()
  getProfile(@Request() req: any) {
    const user: PayLoad = req.user;
    return user;
  }

  //TODO ———————————————[Path Event]———————————————

  @Post('/create-event')
  @isAdmin()
  async handleCreateEventModel(@Body() data: CreateEvent) {
    return await this.userService.handleCreateEventModel(data);
  }

  @Get('/events')
  @isAdmin()
  async getEvents() {
    return await this.userService.handleGetEventModels({});
  }

  //TODO ———————————————[Exchange]———————————————

  @Post('/exchange-gold')
  @isUser()
  async handleExchangeGold(@Body() data: Exchange, @Request() req: any) {
    return await this.userService.handleExchangeGold(data, req.user);
  }

  //TODO ———————————————[Admin Controller]———————————————

  @Get('/all/users')
  @isAdmin()
  async handleGetUser() {
    return await this.userService.handleGetAllUser();
  }

  @Get('/all/users/bet')
  @isAdmin()
  async handleGetUserBet() {
    return await this.userService.handleGetAllUserbet();
  }

  //TODO ———————————————[Non Call Controller]———————————————

  @Get('/rank')
  @Public()
  async handleUserRank() {
    return await this.userService.handleUserRank();
  }

  @Get('/rank/clans')
  @Public()
  async handleUser() {
    return await this.userService.getTopClans(4);
  }

  //TODO ———————————————[User bank and trade]———————————————

  @Post('/trade')
  @isUser()
  async handleUserTrade(@Body() data: UserTrade) {
    return await this.userService.handleUserTrade(data);
  }

  @Post('/bank/withdraw')
  @isUser()
  async handleUserBankWithdraw(@Body() data: UserBankWithDraw) {
    return await this.userService.handleUserBankWithdraw(data);
  }

  //TODO ———————————————[Bet Log User]———————————————

  @Get('/log-bet/all')
  @Public()
  async handleUserBetLogs(
    @Query('limit') limit: any,
    @Query('server') server: any,
    @Query('userId') userId: any,
  ) {
    return await this.userService.handleUserBetLogs(limit, server, userId);
  }

  @Get('/bets/log')
  @isUser()
  async handleUserBetLog(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: any,
  ) {
    const user = req.user;
    return await this.userService.handleUserBetLog(page, limit, user.sub);
  }

  //TODO ———————————————[Get Event Config]———————————————
  @Get('/config')
  @Public()
  async handleUserEventConfig() {
    return await this.userService.handleGetEventModels({});
  }

  //TODO ———————————————[Handle VIP Claim]———————————————
  @Post('/vip/claim')
  @isUser()
  async handleClaimVip(@Req() req: any, @Body() data: any) {
    const user = req.user;
    const now = moment();
    const date = data.date;
    if (now.format('DD/MM/YYYY') !== moment(date).format('DD/MM/YYYY'))
      throw new BadRequestException(
        'Xin lỗi bạn không thể điểm danh cho ngày khác',
      );
    return await this.userService.handleClaimVip(user.sub, date);
  }

  @Get('/vip/info')
  @isUser()
  async handleGetUserInfoVip(@Req() req: any) {
    const user = req.user;
    const targetVip = await this.userService.handleFindUserVip(user.sub);
    return targetVip ?? {};
  }

  //TODO ———————————————[Handle Test API]———————————————
  @Post('/set/vip')
  @isAdmin()
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

  //TODO ———————————————[Handle Mission Daily]———————————————
  @Post('/mission/claim')
  @isUser()
  async handleClaimMission(@Req() req: any, @Body() data: ClaimMission) {
    const user = req.user;
    return await this.userService.handleClaimMission(user, data);
  }

  @Get('/mission')
  @isUser()
  async handleGetMissionDataUser(@Req() req: any) {
    const user = req.user;
    return await this.userService.handleFindMissionUser(user.sub);
  }

  @Get('/reset/rank/user')
  @isAdmin()
  async handleResetRankUser() {
    await this.userService.handleResetRankUser();
    return 'ok';
  }

  @Get('/top-bank')
  @Public()
  async handlerGetTopBank() {
    return this.userService.getTopBank();
  }

  @Post('/v2/place/boss')
  @Public()
  async handlerBotPlaceBoss(@Body() data: CreateUserBet) {
    await this.eventEmitter.emit('bet-user-ce-boss', data);
    return 'ok';
  }

  @Post('/v2/place/24')
  @Public()
  async handlerBotPlace24(@Body() data: CreateUserBet) {
    await this.eventEmitter.emit('bet-user-ce-sv', data);
    return 'ok';
  }

  //TODO ———————————————[Admin Router]———————————————
  @Get('/v3/users')
  @isAdmin()
  async getListUser(@Param() parma: string[]) {
    console.log(parma);
    return 'ok';
  }

  @Get('/v3/list/users')
  @isAdmin()
  async getListUserV3(
    @Query('page') page: number = 1, // Mặc định là trang 1
    @Query('limit') limit: number = 10, // Mặc định là 10 user/trang
    @Query('server') server: string = 'all', // Mặc định là 'all'
    @Query('search') search: string = '', // Mặc định là ''
    @Query('uid') uid: string = '', // Mặc định là ''
    @Query('vip') vip: string = 'all', // Mặc định là 'all'
    @Query('gold') gold: 'asc' | 'desc' | 'all' = 'all', // Mặc định là 'all'
    @Query('trade') trade: 'asc' | 'desc' | 'all' = 'all', // Mặc định là 'all'
    @Query('deposit') deposit: 'asc' | 'desc' | 'all' = 'all', // Mặc định là 'all'
    @Query('withdraw') withdraw: 'asc' | 'desc' | 'all' = 'all', // Mặc định là 'all'
    @Query('totalBet') totalBet: 'asc' | 'desc' | 'all' = 'all', // Mặc định là 'all'
  ) {
    // Chuyển đổi page và limit thành số nguyên
    const pageNumber = parseInt(page.toString(), 10) || 1;
    const limitNumber = parseInt(limit.toString(), 10) || 10;

    return await this.userService.getListUserV3({
      pageNumber: pageNumber,
      limitNumber: limitNumber,
      search,
      uid,
      server,
      vip,
      sort: {
        gold,
        trade,
        deposit,
        withdraw,
        totalBet,
      },
    });
  }

  @Post('/v3/gold/plus')
  @isAdmin()
  async plusGoldUser(@Body() data: { uid: string; amount: number }) {
    const { amount, uid } = data;
    return await this.userService.goldUser({ type: 'plus', amount, uid });
  }
  @Post('/v3/gold/minus')
  @isAdmin()
  async minusGoldUser(@Body() data: { uid: string; amount: number }) {
    const { amount, uid } = data;
    return await this.userService.goldUser({ type: 'minus', amount, uid });
  }
  @Post('/v3/gold/set')
  @isAdmin()
  async setGoldUser(@Body() data: { uid: string; amount: number }) {
    const { amount, uid } = data;
    return await this.userService.goldUser({ type: 'set', amount, uid });
  }

  @Post('/v3/ban')
  @isAdmin()
  async setBanUser(@Body() data: { uid: string; reason: string }) {
    const { reason, uid } = data;
    return await this.userService.banUser({ uid, reason });
  }
  @Post('/v3/unban')
  @isAdmin()
  async setUnBanUser(@Body() data: { uid: string; reason: string }) {
    const { reason, uid } = data;
    return await this.userService.unBanUser({ uid, reason });
  }

  @Post('/v3/delete')
  @isAdmin()
  async deleteUser(@Body() data: { uid: string }) {
    const { uid } = data;
    return await this.userService.deleteUser({ uid });
  }
}
