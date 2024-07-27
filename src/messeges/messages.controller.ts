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
import { MessegesService } from './messeges.service';

@Controller('message')
export class MessagesController {
  constructor(private readonly messegesService: MessegesService) {}

  @Get('/all')
  async handleGetMessage(@Query('page') page: any, @Query('limit') limit: any) {
    return await this.messegesService.MessageGetAll(page, limit);
  }
}
