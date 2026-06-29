import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { RedisModule } from '../redis/redis.module';
import { GatewayModule } from '../gateway/gateway.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [RedisModule, GatewayModule, VehiclesModule, MetricsModule],
  providers: [MqttService],
})
export class MqttModule {}
