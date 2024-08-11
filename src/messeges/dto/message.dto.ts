export class CreateMessage {
  uid: string;
  content: string;
  server: string;
  meta?: string;
  username?: string;
}

export class CreateMessagesBan {
  uid: string;
  isBan: boolean;
  isReason?: string;
}
