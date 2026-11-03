import { Module } from '@nestjs/common';
import { CitiesController } from './cities.controller';
import { GeoService } from './geo.service';
import { StatesController } from './states.controller';

@Module({
  controllers: [StatesController, CitiesController],
  providers: [GeoService],
})
export class GeoModule {}
