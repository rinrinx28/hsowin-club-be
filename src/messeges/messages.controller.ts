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
import { CreateMessage } from './dto/message.dto';
import { SocketGateway } from 'src/socket/socket.gateway';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('message')
export class MessagesController {
  constructor(
    private readonly messegesService: MessegesService,
    private readonly socketGateway: SocketGateway,
  ) {}

  @Get('/all')
  async handleGetMessage(@Query('page') page: any, @Query('limit') limit: any) {
    return await this.messegesService.MessageGetAll(page, limit);
  }

  @Post('/system')
  @UseGuards(AuthGuard)
  async handleSendMessage(@Body() data: CreateMessage) {
    const msg = await this.messegesService.MessageCreate(data);
    this.socketGateway.server.emit('system-message', msg);
    return 'ok';
  }
}
