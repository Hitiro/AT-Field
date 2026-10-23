import {
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { City } from './city.entity.js';

@Entity('states')
export class State {
  // código IBGE da UF (2 dígitos)
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'char', length: 2, unique: true })
  uf!: string;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @OneToMany(() => City, (city) => city.state)
  cities!: Relation<City[]>;
}
