import { IsNotEmpty, IsString, IsEmail } from 'class-validator';
export class CreateAuthDto {
  @IsNotEmpty({ message: 'username không thể để trống' })
  username: string;

  @IsNotEmpty({ message: 'email không thể để trống' })
  @IsEmail()
  email: string;

  @IsNotEmpty({ message: 'pwd_h không thể để trống' })
  pwd_h: string;

  @IsNotEmpty({ message: 'server không thể để trống' })
  server: string;
}
