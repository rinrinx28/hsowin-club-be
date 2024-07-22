import {
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
import { CreateSessionDto } from './dto/session.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('session')
@UseGuards(AuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @HttpCode(HttpStatus.OK)
  @Post('/create')
  create(@Body() body: CreateSessionDto, @Req() req: any) {
    const user = req.user;
    return this.sessionService.create(body, user);
  }

  @HttpCode(HttpStatus.OK)
  @Get('/find')
  find(@Req() req: any) {
    const user = req.user;
    return this.sessionService.findAllByUID(user);
  }
}
