import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BetLogService } from './bet-log.service';
import { TopBetServer } from './dto/bet-log.dto';
import { Public, isAdmin } from 'src/auth/decorators/public.decorator';

@Controller('bet-log')
export class BetLogController {
  constructor(private readonly betLogService: BetLogService) {}
  @Post('/topBet/server')
  @Public()
  async handleTopBetServer(@Body() data: TopBetServer) {
    if (data.server.endsWith('mini') || data.server === '24') {
      return await this.betLogService.handleTopBetServer(data);
    } else {
      return await this.betLogService.handleTopBetServerBoss(data);
    }
  }

  @Get('/all/server')
  @Public()
  async handleGetAllServer() {
    return await this.betLogService.handleGetAllServer();
  }

  @Get('/all/boss')
  @Public()
  async handleGetAllBoss() {
    return await this.betLogService.handleGetAllBoss();
  }

  @Get('/history/server/:id')
  @Public()
  async handleGetHistoryServer(@Param('id') id: any) {
    if (id === '24') {
      return await this.betLogService.findBetHistoryByServer(id);
    }
    return;
  }

  @Get('/live')
  @isAdmin()
  async handlerGetServerLive() {
    return await this.betLogService.handlerLive();
  }

  @Get('/result/24/:betId')
  @isAdmin()
  async getResult24(@Param('betId') betId: string) {
    return await this.betLogService.getResult24(betId);
  }

  @Post('/change/24/:betId')
  @isAdmin()
  async changeResult24(@Param('betId') betId: string, @Body() body: any) {
    const { newResult } = body;
    return await this.betLogService.changeResult24(betId, newResult);
  }
}
