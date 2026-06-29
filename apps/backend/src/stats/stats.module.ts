import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { MetricsModule } from '../metrics/metrics.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports:     [MetricsModule, RedisModule],
  controllers: [StatsController],
})
export class StatsModule {}
