import { citySearchSchema } from '@at-field/dto';
import { createZodDto } from 'nestjs-zod';

export class CitySearchDto extends createZodDto(citySearchSchema) {}
