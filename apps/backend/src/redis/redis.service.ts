import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async setVehiclePosition(vehicleId: string, data: object): Promise<void> {
    await this.client.set(`vehicle:${vehicleId}:position`, JSON.stringify(data));
    await this.client.sadd('vehicle:ids', vehicleId);
  }

  async getAllVehiclePositions(): Promise<object[]> {
    const ids = await this.client.smembers('vehicle:ids');
    if (!ids.length) return [];
    const raw = await Promise.all(ids.map((id) => this.client.get(`vehicle:${id}:position`)));
    return raw.filter(Boolean).map((p) => JSON.parse(p as string));
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
