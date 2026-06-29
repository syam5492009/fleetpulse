import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('telemetry_events')
@Index(['vehicleId', 'timestamp'])
export class TelemetryEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vehicleId: string;

  @Column('double precision')
  lat: number;

  @Column('double precision')
  lng: number;

  @Column('double precision')
  speed: number;

  @Column('double precision')
  battery: number;

  @Column()
  status: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
}
