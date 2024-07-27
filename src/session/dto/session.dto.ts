export class CreateSessionDto {
  server: string;
  type: string;
  amount: number;
  playerName: string;
  uid: string;
}

export class CancelSession {
  sessionId: string;
  uid: string;
}

export class BankCreate {
  uid: string;
  amount: number;
  orderId?: string;
}
