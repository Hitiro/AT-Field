import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CitySearchDto } from './dto';
import { GEO_PUBLIC_CACHE, GeoCacheInterceptor } from './geo-cache.interceptor';
import { GeoService, matchesEtag } from './geo.service';

// Público (sem X-Tenant-Id e, no futuro, sem login): base IBGE de referência.
// Cache público só nas respostas de sucesso (GeoCacheInterceptor).
@ApiTags('geo')
@UseInterceptors(GeoCacheInterceptor)
@Controller('cities')
export class CitiesController {
  constructor(private readonly geo: GeoService) {}

  @Get()
  search(@Query() query: CitySearchDto) {
    return this.geo.search(query);
  }

  // Declarada antes de :id. Base completa para o app guardar offline; o ETag
  // é a versão do retrato, então If-None-Match igual responde 304 sem corpo.
  // Usa @Res(), então define o Cache-Control público ela mesma (200 e 304).
  @Get('all')
  @ApiOkResponse({
    description:
      'CitiesBundleView: { version, states: [id, uf, nome][], cities: [id, stateId, nome][] }. 304 se If-None-Match bater com o ETag.',
  })
  all(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() res: Response,
  ) {
    const { etag, body } = this.geo.getBundle();
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', GEO_PUBLIC_CACHE);
    if (matchesEtag(ifNoneMatch, etag)) {
      res.status(304).end();
      return;
    }
    res.status(200).json(body);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.geo.findCity(id);
  }
}
