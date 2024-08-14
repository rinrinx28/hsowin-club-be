import { Controller, Get, UseGuards } from '@nestjs/common';
import { BotService } from './bot.service';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('bot')
export class BotController {
  constructor(private botService: BotService) {}

  @Get('/all')
  @Public()
  async handleBots() {
    return await this.botService.getAll();
  }
}
