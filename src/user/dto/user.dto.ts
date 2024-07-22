import { IsNotEmpty, IsString } from 'class-validator';

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
  @IsNotEmpty({ message: 'ClanName cannot be empty' })
  clanName: string;

  @IsNotEmpty({ message: 'ownerId cannot be empty' })
  ownerId: string;

  @IsNotEmpty({ message: 'typeClan cannot be empty' })
  typeClan: string;
}

export class MemberClans {
  @IsNotEmpty({ message: 'uid cannot be empty' })
  uid: string;

  @IsNotEmpty({ message: 'clanId cannot be empty' })
  clanId: string;
}
