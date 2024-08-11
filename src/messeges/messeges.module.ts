import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Messeges, MessegesSchema } from './schema/messeges.schema';
import { MessegesService } from './messeges.service';
import { MessagesController } from './messages.controller';
import { WebSocketModule } from 'src/socket/socket.module';
import { MessegesBan, MessegesBanSchema } from './schema/messegesBan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Messeges.name, schema: MessegesSchema },
      { name: MessegesBan.name, schema: MessegesBanSchema },
    ]),
    WebSocketModule,
  ],
  controllers: [MessagesController],
  providers: [MessegesService],
  exports: [MessegesService],
})
export class MessagesModule {}
