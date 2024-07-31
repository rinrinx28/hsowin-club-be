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
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: Record<string, any>, @Req() req: any) {
    return this.authService.signIn(signInDto.username, signInDto.password, req);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @Get('relogin')
  reSignIn(@Req() req: any) {
    const user = req.user;
    return this.authService.relogin(user, req);
  }

  @HttpCode(HttpStatus.OK)
  @Post('resgiter')
  async signUp(@Body() signUpDto: CreateAuthDto, @Req() req: any) {
    return await this.authService.signUp(signUpDto, req);
  }
}
