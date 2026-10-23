import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PERMISSIONS } from '@at-field/dto';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';

// O catálogo de permissões vive no código (@at-field/dto); ao subir, a API
// garante que a tabela `permissions` contém todas as chaves.
@Injectable()
export class PermissionsSyncService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
  ) {}

  async onApplicationBootstrap() {
    await this.sync();
  }

  async sync() {
    await this.permissions.upsert(
      Object.entries(PERMISSIONS).map(([key, description]) => ({
        key,
        description,
      })),
      ['key'],
    );
  }
}
