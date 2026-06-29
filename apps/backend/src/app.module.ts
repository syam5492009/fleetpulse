import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from './redis/redis.module';
import { GatewayModule } from './gateway/gateway.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { MqttModule } from './mqtt/mqtt.module';
import { MetricsModule } from './metrics/metrics.module';
import { StatsModule } from './stats/stats.module';
import { TelemetryEvent } from './vehicles/entities/telemetry.entity';
import { MqttMetric } from './metrics/mqtt-metric.entity';
import { InitPostgis1700000000000 } from './migrations/1700000000000-InitPostgis';
import { MqttMetrics1700000000001 } from './migrations/1700000000001-MqttMetrics';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://fleetpulse:fleetpulse@localhost:5432/fleetpulse',
      entities: [TelemetryEvent, MqttMetric],
      synchronize: false,
      migrations: [InitPostgis1700000000000, MqttMetrics1700000000001],
      migrationsRun: true,
    }),
    RedisModule,
    GatewayModule,
    VehiclesModule,
    MqttModule,
    MetricsModule,
    StatsModule,
  ],
})
export class AppModule {}
