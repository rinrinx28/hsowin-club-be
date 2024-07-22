import { IsNotEmpty, IsString, IsEmail } from 'class-validator';
export class CreateAuthDto {
  @IsNotEmpty({ message: 'username cannot be empty' })
  username: string;

  @IsNotEmpty({ message: 'email cannot be empty' })
  @IsEmail()
  email: string;

  @IsNotEmpty({ message: 'pwd_h cannot be empty' })
  pwd_h: string;

  @IsNotEmpty({ message: 'server cannot be empty' })
  server: string;
}
