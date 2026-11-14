import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ufSchema } from '@at-field/dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { Public } from '../auth/public.decorator';
import { GeoCacheInterceptor } from './geo-cache.interceptor';
import { GeoService } from './geo.service';

// Público (@Public: sem login e sem X-Tenant-Id): base IBGE de referência.
// Cache público só nas respostas de sucesso (GeoCacheInterceptor).
@ApiTags('geo')
@Public()
@UseInterceptors(GeoCacheInterceptor)
@Controller('states')
export class StatesController {
  constructor(private readonly geo: GeoService) {}

  @Get()
  list() {
    return this.geo.listStates();
  }

  @Get(':uf/cities')
  cities(@Param('uf', new ZodValidationPipe(ufSchema)) uf: string) {
    return this.geo.listCitiesByUf(uf);
  }
}
