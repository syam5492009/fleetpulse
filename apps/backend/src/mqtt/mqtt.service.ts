import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { RedisService } from '../redis/redis.service';
import { VehiclesService, TelemetryPayload } from '../vehicles/vehicles.service';
import { FleetGateway } from '../gateway/fleet.gateway';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;

  constructor(
    private readonly redisService:    RedisService,
    private readonly vehiclesService: VehiclesService,
    private readonly fleetGateway:    FleetGateway,
    private readonly metricsService:  MetricsService,
  ) {}

  onModuleInit() {
    const broker = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
    this.client = mqtt.connect(broker);

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker: ${broker}`);
      this.client.subscribe('fleet/vehicles/+', (err) => {
        if (err) this.logger.error('Subscribe error', err);
        else this.logger.log('Subscribed to fleet/vehicles/+');
      });
    });

    this.client.on('message', async (topic, message) => {
      const t0 = performance.now();
      try {
        const vehicleId = topic.split('/')[2];
        const payload: TelemetryPayload = { vehicleId, ...JSON.parse(message.toString()) };

        await Promise.all([
          this.redisService.setVehiclePosition(vehicleId, payload),
          this.vehiclesService.saveTelemetry(payload),
        ]);

        this.fleetGateway.broadcastVehicleUpdate(payload);

        const processingTimeMs = performance.now() - t0;
        // Fire-and-forget — metric write must not block or fail the pipeline
        this.metricsService.recordMessage(vehicleId, processingTimeMs).catch((err) =>
          this.logger.warn('Failed to record MQTT metric', err),
        );
      } catch (err) {
        this.logger.error(`Failed to process message on ${topic}`, err);
      }
    });

    this.client.on('error', (err) => this.logger.error('MQTT error', err));
  }

  onModuleDestroy() {
    this.client?.end();
  }
}
