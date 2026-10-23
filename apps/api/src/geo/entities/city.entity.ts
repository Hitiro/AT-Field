import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { State } from './state.entity';

@Entity('cities')
export class City {
  // código IBGE do município (7 dígitos)
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'int' })
  stateId!: number;

  @ManyToOne(() => State, (state) => state.cities)
  @JoinColumn({ name: 'stateId' })
  state!: Relation<State>;

  @Index()
  @Column({ type: 'varchar', length: 120 })
  name!: string;
}
