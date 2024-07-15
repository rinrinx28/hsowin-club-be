import { Controller } from '@nestjs/common';
import { BetLogService } from './bet-log.service';

@Controller('bet-log')
export class BetLogController {
  constructor(private readonly betLogService: BetLogService) {}
}
