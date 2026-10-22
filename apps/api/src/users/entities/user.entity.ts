import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { City } from '../../geo/entities/city.entity'
import { Membership } from '../../memberships/entities/membership.entity'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 128, unique: true, nullable: true })
  firebaseUid!: string | null

  @Column({ type: 'varchar', length: 11, unique: true })
  cpf!: string

  @Column({ type: 'varchar', length: 150 })
  name!: string

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null

  @Column({ type: 'int', nullable: true })
  cityId!: number | null

  @ManyToOne(() => City, { nullable: true })
  @JoinColumn({ name: 'cityId' })
  city!: City | null

  @Column({ type: 'boolean', default: true })
  isActive!: boolean

  @OneToMany(() => Membership, membership => membership.user)
  memberships!: Membership[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  @DeleteDateColumn()
  deletedAt!: Date | null
}
