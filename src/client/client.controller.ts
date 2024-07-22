import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ClientService } from './client.service';

@Controller('/api/client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Get('/:UUID/boss')
  getStatusBoss(
    @Param('UUID') uuid: any,
    @Query('content') content: any,
    @Query('server') server: any,
  ): any {
    const data = { content, server, uuid };
    return this.clientService.getStatusBoss(data);
  }

  @Get('/:UUID/bot')
  getStatusBot(
    @Param('UUID') uuid: any,
    @Query('id') id: any,
    @Query('name') name: any,
    @Query('map') map: any,
    @Query('zone') zone: any,
    @Query('gold') gold: any,
    @Query('server') server: any,
  ): any {
    const data = { uuid, id, name, map, zone, gold, server };
    return this.clientService.getStatusBot(data);
  }

  @Get('/:UUID/service')
  getStatusProduct(
    @Param('UUID') uuid: any,
    @Query('type') type: any,
    @Query('bot_id') bot_id: any,
    @Query('player_id') player_id: any,
    @Query('player_name') player_name: string,
    @Query('gold_last') gold_last: any,
    @Query('gold_current') gold_current: any,
    @Query('gold_trade') gold_trade: any,
    @Query('gold_receive') gold_receive: any,
    @Query('service_id') service_id: any,
    @Query('server') server: any,
  ): any {
    const data = {
      uuid,
      type,
      bot_id,
      player_id,
      player_name,
      gold_last,
      gold_current,
      gold_trade,
      gold_receive,
      service_id,
      server,
    };
    return this.clientService.getTransaction(data);
  }

  @Post('/hsowin-bank')
  handleDoiThe(@Body() data: any) {
    console.log(data);
  }
}
