export class MessageResult {
  message: string;
  status: boolean;
  data?: any;
  server?: any;
}

export class ResultBet {
  betId: string;
  result: string;
  server: string;
}
export class ResultBetBoss {
  betId: string;
  result: string;
  server: string;
}

export class CreateEvent {
  name: string;
  value: number;
  description?: string;
  status?: boolean;
  option?: string;
}
