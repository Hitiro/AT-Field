import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Público: verificação simples de que a API está no ar.
  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }
}
