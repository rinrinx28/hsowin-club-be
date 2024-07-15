import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('')
  getStatusBot(): any {
    return this.appService.getHello();
  }
}
