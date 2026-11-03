import { addMemberSchema, updateMemberSchema } from '@at-field/dto';
import { createZodDto } from 'nestjs-zod';

export class AddMemberDto extends createZodDto(addMemberSchema) {}
export class UpdateMemberDto extends createZodDto(updateMemberSchema) {}
