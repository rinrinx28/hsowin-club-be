import { Controller, Get, UseGuards } from '@nestjs/common';
import { BotService } from './bot.service';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('bot')
@UseGuards(AuthGuard)
export class BotController {
  constructor(private botService: BotService) {}

  @Get('/all')
  async handleBots() {
    return await this.botService.getAll();
  }
}
