import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import type { MembershipStatus } from '@at-field/dto'
import { Role } from '../../roles/entities/role.entity'
import { Tenant } from '../../tenants/entities/tenant.entity'
import { User } from '../../users/entities/user.entity'

@Entity('memberships')
@Unique(['userId', 'tenantId'])
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  userId!: string

  @ManyToOne(() => User, user => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column({ type: 'uuid' })
  tenantId!: string

  @ManyToOne(() => Tenant, tenant => tenant.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant

  @Column({ type: 'uuid' })
  roleId!: string

  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roleId' })
  role!: Role

  @Column({
    type: 'enum',
    enum: ['invited', 'active', 'suspended'],
    enumName: 'membership_status',
    default: 'invited',
  })
  status!: MembershipStatus

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
