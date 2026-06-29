import { Controller, Get } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';
import { RedisService } from '../redis/redis.service';

interface VehiclePosition {
  vehicleId: string;
  status: string;
  speed: number;
  battery: number;
  timestamp: string;
}

@Controller('stats')
export class StatsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly redisService:   RedisService,
  ) {}

  @Get()
  async getStats() {
    const [mqttStats, allVehicles] = await Promise.all([
      this.metricsService.getStats60s(),
      this.redisService.getAllVehiclePositions() as Promise<VehiclePosition[]>,
    ]);

    const vehiclesOnline = allVehicles.filter((v) => v.status === 'online').length;
    const vehiclesAlert  = allVehicles.filter((v) => v.status === 'alert').length;

    return {
      vehiclesTotal:    allVehicles.length,
      vehiclesOnline,
      vehiclesAlert,
      messagesLast60s:  mqttStats.messagesLast60s,
      avgLatencyMs:     Math.round(mqttStats.avgLatencyMs * 100) / 100,
    };
  }
}
