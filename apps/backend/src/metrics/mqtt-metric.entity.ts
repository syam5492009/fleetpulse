import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('mqtt_metrics')
@Index(['timestamp'])
export class MqttMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vehicleId: string;

  @Column('double precision')
  processingTimeMs: number;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  timestamp: Date;
}
