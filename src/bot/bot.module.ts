import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotService } from './bot.service';
import { Bot, BotSchema } from './schema/bot.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Bot.name, schema: BotSchema }])],
  controllers: [],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
