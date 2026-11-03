import { signupSchema, updateTenantSchema } from '@at-field/dto';
import { createZodDto } from 'nestjs-zod';

export class SignupDto extends createZodDto(signupSchema) {}
export class UpdateTenantDto extends createZodDto(updateTenantSchema) {}
