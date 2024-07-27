import { IsNotEmpty, IsString } from 'class-validator';

//TODO ———————————————[DTO User]———————————————
export class CreateUserDto {
  username: string;
  pwd_h: string;
}

//TODO ———————————————[DTO Bet User]———————————————

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

//TODO ———————————————[DTO Clans]———————————————

export class CreateClans {
  @IsNotEmpty({ message: 'ClanName không thể để trống' })
  clanName: string;

  @IsNotEmpty({ message: 'ownerId không thể để trống' })
  ownerId: string;

  @IsNotEmpty({ message: 'typeClan không thể để trống' })
  typeClan: string;
}

export class MemberClans {
  @IsNotEmpty({ message: 'uid không thể để trống' })
  uid: string;

  @IsNotEmpty({ message: 'clanId không thể để trống' })
  clanId: string;
}

//TODO ———————————————[DTO Exchange]———————————————
export class Exchange {
  diamon: number;
}

export class UserTrade {
  targetId: any;
  amount: number;
  userId: any;
}

export class UserBankWithDraw {
  uid: string;
  amount: number;
  accountName: string;
  accountNumber: string;
  bankName?: string;
  type: string;
}

export class UserBankWithDrawUpdate {
  uid: string;
  withdrawId: string;
  status: string;
}
