export class CreateUserBet {
  betId: any;
  uid: any;
  amount: number;
  result: string;
  server: string;
}

export class DelUserBet {
  betId: any;
  uid: any;
  userBetId: any;
}

export class ResultDataBet {
  betId: string;
  counter: number;
}

export class ValueBetUserSv {
  betId: string;
  server: string;
}
