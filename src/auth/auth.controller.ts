import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/auth.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @Public()
  signIn(@Body() signInDto: Record<string, any>, @Req() req: any) {
    return this.authService.signIn(signInDto.username, signInDto.password, req);
  }

  @HttpCode(HttpStatus.OK)
  @Get('relogin')
  reSignIn(@Req() req: any) {
    const user = req.user;
    return this.authService.relogin(user, req);
  }

  @HttpCode(HttpStatus.OK)
  @Post('resgiter')
  @Public()
  async signUp(@Body() signUpDto: CreateAuthDto, @Req() req: any) {
    return await this.authService.signUp(signUpDto, req);
  }
}
