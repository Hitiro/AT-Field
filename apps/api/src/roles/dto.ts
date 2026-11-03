import { createRoleSchema, updateRoleSchema } from '@at-field/dto';
import { createZodDto } from 'nestjs-zod';

export class CreateRoleDto extends createZodDto(createRoleSchema) {}
export class UpdateRoleDto extends createZodDto(updateRoleSchema) {}
