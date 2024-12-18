import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CreateUserBet,
  DelUserBet,
  DiemDanh,
  MessagesChat,
  ResultDataBet,
  ValueBetUserSv,
} from './dto/socket.dto';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'https://hsgame.me',
      'https://www.hsgame.me',
      'https://admin.hsgame.me',
      'https://www.admin.hsgame.me',
    ],
    credentials: true,
  },
  transports: ['websocket'],
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('SocketGateway');

  constructor(private eventEmitter: EventEmitter2) {}

  @SubscribeMessage('message')
  handleMessage(@MessageBody() message: string): void {
    this.eventEmitter.emit('message', message);
  }

  @SubscribeMessage('bet-user-ce-boss')
  async handleBetUserBoss(@MessageBody() data: CreateUserBet) {
    await this.eventEmitter.emitAsync('bet-user-ce-boss', data);
  }

  @SubscribeMessage('bet-user-ce-sv')
  async handleBetUserSv(@MessageBody() data: CreateUserBet) {
    await this.eventEmitter.emitAsync('bet-user-ce-sv', data);
  }

  @SubscribeMessage('bet-user-del-boss')
  async handleDelBetUserBoss(@MessageBody() data: DelUserBet) {
    await this.eventEmitter.emitAsync('bet-user-del-boss', data);
  }

  @SubscribeMessage('bet-user-del-sv')
  async handleDelBetUserSv(@MessageBody() data: DelUserBet) {
    await this.eventEmitter.emitAsync('bet-user-del-sv', data);
  }

  @SubscribeMessage('value-bet-users')
  async handleValueBetUserSv(@MessageBody() data: ValueBetUserSv) {
    await this.eventEmitter.emitAsync('value-bet-users', data);
  }

  @SubscribeMessage('result-data-bet')
  async handleResultDataBet(@MessageBody() data: ResultDataBet) {
    if (data.counter === 7) {
      await this.eventEmitter.emitAsync('result-data-bet', data);
    }
  }

  @SubscribeMessage('message-user')
  async handleMessageUser(@MessageBody() data: MessagesChat) {
    await this.eventEmitter.emitAsync('message-user', data);
  }

  @SubscribeMessage('message-clan')
  async handleMessageClan(@MessageBody() data: MessagesChat) {
    await this.eventEmitter.emitAsync('message-clan', data);
  }

  @SubscribeMessage('message-admin')
  async handleMessageAdmin(@MessageBody() data: string) {
    await this.eventEmitter.emitAsync('noti-system', data);
  }

  @SubscribeMessage('diem-danh')
  async handleDiemDanh(@MessageBody() data: DiemDanh) {
    await this.eventEmitter.emitAsync('diem-danh', data);
  }

  @SubscribeMessage('diem-danh-got')
  async handleDiemDanhGot(@MessageBody() data: DiemDanh) {
    await this.eventEmitter.emitAsync('diem-danh-got');
  }

  afterInit(server: Server) {
    this.logger.log('Init');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}
