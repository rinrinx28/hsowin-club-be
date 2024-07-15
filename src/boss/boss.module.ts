import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BossService } from './boss.service';
import { Boss, BossSchema } from './schema/boss.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Boss.name, schema: BossSchema }]),
  ],
  controllers: [],
  providers: [BossService],
  exports: [BossService],
})
export class BossModule {}
