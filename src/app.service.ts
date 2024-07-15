import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
  hexToAscii(hex: string): string {
    let ascii = '';
    for (let i = 0; i < hex.length; i += 2) {
      const hexCode = hex.substr(i, 2);
      const char = String.fromCharCode(parseInt(hexCode, 16));
      ascii += char;
    }
    return ascii;
  }
}
