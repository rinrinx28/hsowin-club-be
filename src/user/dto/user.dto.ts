export class CreateUserDto {}

export class CreateUserBetDto {
  uid: string;
  betId: string;
  amount: number;
  result: string;
  server: string;
}

export class FindUserBetDto {
  uid: any;
  betId: any;
  isEnd: boolean;
  server: string;
}

export class CreateClans {
  clansName: string;
  ownerId: string;
}

export class MemberClans {
  uid: string;
  clanId: string;
}
