export class CreateUserDto {}

export class CreateUserBetDto {
  uid: string;
  betId: string;
  amount: number;
  result: string;
  server: string;
}

export class FindUserBetDto {
  id: string;
  betId: string;
  isEnd: boolean;
  server: string;
}
