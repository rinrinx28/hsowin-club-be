import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Messeges, MessegesSchema } from './schema/messeges.schema';
import { MessegesService } from './messeges.service';
import { MessagesController } from './messages.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Messeges.name, schema: MessegesSchema },
    ]),
  ],
  controllers: [MessagesController],
  providers: [MessegesService],
  exports: [MessegesService],
})
export class MessagesModule {}
