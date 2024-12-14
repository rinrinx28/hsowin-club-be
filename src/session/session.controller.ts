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
import { UserService } from 'src/user/user.service';
import { isAdmin, isUser } from 'src/auth/decorators/public.decorator';
import { Mutex } from 'async-mutex';
import { CatchException } from 'src/common/common.exception';
import { SocketGateway } from 'src/socket/socket.gateway';

@Controller('session')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly userService: UserService,
    private readonly socketGateway: SocketGateway,
  ) {}

  private readonly mutexMap = new Map<string, Mutex>();

  @Post('/create')
  @isUser()
  create(@Body() body: CreateSessionDto, @Req() req: any) {
    const user = req.user;
    if (user.sub !== body.uid)
      throw new BadGatewayException('Lỗi UID Người Chơi không khớp');
    return this.sessionService.create({ ...body }, user);
  }

  @Post('/cancel')
  @isUser()
  async cancel(@Body() data: CancelSession) {
    const parameter = `${data.sessionId}-session-cancel`; // Value will be lock

    // Create mutex if it not exist
    if (!this.mutexMap.has(parameter)) {
      this.mutexMap.set(parameter, new Mutex());
    }

    const mutex = this.mutexMap.get(parameter);
    const release = await mutex.acquire();
    try {
      const target = await this.sessionService.findByID(data?.sessionId);
      if (!target)
        throw new BadGatewayException('Không tìm thấy phiên giao dịch');
      if (target.type === '1') {
        await this.userService.update(data.uid, {
          $inc: {
            gold: +target.amount,
            trade: -target.amount,
            limitedTrade: +target.amount,
          },
        });
      }
      const service_cancel = await this.sessionService.updateById(
        data?.sessionId,
        {
          status: '1',
        },
      );
      this.socketGateway.server.emit('session-res', service_cancel.toObject());
      return service_cancel;
    } catch (err: any) {
      throw new CatchException(err);
    } finally {
      release();
    }
  }

  @Get('/find')
  @isUser()
  find(@Req() req: any) {
    const user = req.user;
    return this.sessionService.findAllByUID(user);
  }

  @Get('/all')
  @isUser()
  async getAll(@Req() req: any) {
    const user = req.user;
    return await this.sessionService.findAllSesions(user);
  }

  @Get('/user')
  @isUser()
  async handleUserSession(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: any,
  ) {
    const user = req.user;
    return await this.sessionService.findSessionWithUser(page, limit, user.sub);
  }

  @Post('/banking/create')
  @isUser()
  async handleBankCreate(@Body() data: BankCreate) {
    return await this.sessionService.handleCreateBank(data);
  }

  @Post('/banking/update')
  @isUser()
  async handleBankUpdate(@Query('orderId') orderId: any) {
    return await this.sessionService.handleUpdateBank(orderId, '2');
  }

  @Get('/banking/log/nap')
  @isUser()
  async handleBankLogNap(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: any,
  ) {
    const user = req.user;
    return await this.sessionService.handleBankLogUser(page, limit, user.sub);
  }

  @Get('/banking/log/rut')
  @isUser()
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

  //TODO ———————————————[Admin Router]———————————————
  @Get('/v3/list/services')
  @isAdmin()
  async getListServicesV3(
    @Query('page') page: number = 1, // Mặc định là trang 1
    @Query('limit') limit: number = 10, // Mặc định là 10 user/trang
    @Query('server') server: string = 'all', // Mặc định là 'all'
    @Query('type') type: string = 'all', // Mặc định là 'all'
    @Query('uid') uid: string = '', // Mặc định là ''
    @Query('playerName') playerName: string = '', // Mặc định là ''
    @Query('gold') gold: 'asc' | 'desc' | 'all' = 'all', // Mặc định là 'all'
  ) {
    // Chuyển đổi page và limit thành số nguyên
    const pageNumber = parseInt(page.toString(), 10) || 1;
    const limitNumber = parseInt(limit.toString(), 10) || 10;

    return await this.sessionService.getListServicesV3({
      pageNumber: pageNumber,
      limitNumber: limitNumber,
      uid,
      server,
      playerName,
      type,
      sort: {
        gold,
      },
    });
  }
}
