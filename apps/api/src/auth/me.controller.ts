import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { MeResponse } from '@at-field/dto';
import { User } from '../users/entities/user.entity';
import { AuthMeService } from './auth-me.service';
import { CurrentUser } from './current-user.decorator';

@ApiTags('auth')
@Controller('me')
export class MeController {
  constructor(private readonly me: AuthMeService) {}

  // Só autenticado, sem X-Tenant-Id: a pessoa e todos os vínculos dela
  // (inclusive convites e suspensos). No primeiro login o AuthGuard já fez o
  // vínculo pelo e-mail verificado.
  @Get()
  get(@CurrentUser() user: User): Promise<MeResponse> {
    return this.me.describe(user);
  }
}
