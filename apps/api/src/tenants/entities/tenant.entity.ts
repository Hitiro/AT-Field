import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import type { DocumentType } from '@at-field/dto';
import { Membership } from '../../memberships/entities/membership.entity.js';
import { Role } from '../../roles/entities/role.entity.js';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ['CPF', 'CNPJ'], enumName: 'document_type' })
  documentType!: DocumentType;

  @Column({ type: 'varchar', length: 14, unique: true })
  document!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => Membership, (membership) => membership.tenant)
  memberships!: Relation<Membership[]>;

  @OneToMany(() => Role, (role) => role.tenant)
  roles!: Relation<Role[]>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
