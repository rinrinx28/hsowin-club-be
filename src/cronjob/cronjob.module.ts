import { Module } from '@nestjs/common';
import { CronjobService } from './cronjob.service';

@Module({
  providers: [CronjobService],
  exports: [CronjobService],
})
export class CronjobModule {}
