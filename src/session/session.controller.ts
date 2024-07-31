import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { BankCreate, CancelSession, CreateSessionDto } from './dto/session.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { UserService } from 'src/user/user.service';

@Controller('session')
@UseGuards(AuthGuard)
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly userService: UserService,
  ) {}

  // @HttpCode(HttpStatus.OK)
  // @Post('/admin/create')
  // adminCreate(@Body() body: CreateSessionDto, @Req() req: any) {
  //   const user = req.user;
  //   return this.sessionService.create(body, user);
  // }

  @HttpCode(HttpStatus.OK)
  @Post('/create')
  create(@Body() body: CreateSessionDto, @Req() req: any) {
    const user = req.user;
    if (user.sub !== body.uid)
      throw new BadGatewayException('Lỗi UID Người Chơi không khớp');
    return this.sessionService.create({ ...body }, user);
  }

  @Post('/cancel')
  async cancel(@Body() data: CancelSession) {
    const target = await this.sessionService.findByID(data?.sessionId);
    if (!target)
      throw new BadGatewayException('Không tìm thấy phiên giao dịch');
    if (target.type === '1') {
      await this.userService.update(data.uid, {
        $inc: {
          gold: +target.amount,
        },
      });
    }
    return await this.sessionService.updateById(data?.sessionId, {
      status: '1',
    });
  }

  @HttpCode(HttpStatus.OK)
  @Get('/find')
  find(@Req() req: any) {
    const user = req.user;
    return this.sessionService.findAllByUID(user);
  }

  @Get('/all')
  async getAll(@Req() req: any) {
    const user = req.user;
    return await this.sessionService.findAllSesions(user);
  }

  @Get('/user')
  async handleUserSession(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: any,
  ) {
    const user = req.user;
    return await this.sessionService.findSessionWithUser(page, limit, user.sub);
  }

  @Post('/banking/create')
  async handleBankCreate(@Body() data: BankCreate) {
    return await this.sessionService.handleCreateBank(data);
  }

  @Post('/banking/update')
  async handleBankUpdate(@Query('orderId') orderId: any) {
    return await this.sessionService.handleUpdateBank(orderId, '2');
  }

  @Get('/banking/log/nap')
  async handleBankLogNap(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: any,
  ) {
    const user = req.user;
    return await this.sessionService.handleBankLogUser(page, limit, user.sub);
  }

  @Get('/banking/log/rut')
  async handleBankLogRut(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: any,
  ) {
    const user = req.user;
    return await this.sessionService.handleBankLogUserRut(
      page,
      limit,
      user.sub,
    );
  }
}
