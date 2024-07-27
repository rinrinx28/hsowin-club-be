export class CreateSessionDto {
  server: string;
  type: string;
  amount: number;
  playerName: string;
}

export class BankCreate {
  uid: string;
  amount: number;
  orderId?: string;
}
