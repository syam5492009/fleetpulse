import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

export interface MqttStats {
  messagesLast60s: number;
  avgLatencyMs: number;
}

// Keep mqtt_metrics for 7 days, telemetry_events for 30 days.
// A lightweight setInterval is sufficient for a dev/portfolio project;
// replace with pg_cron or a NestJS ScheduleModule job for production.
const METRICS_RETENTION_DAYS    = 7;
const TELEMETRY_RETENTION_DAYS  = 30;
const CLEANUP_INTERVAL_MS       = 6 * 60 * 60 * 1000; // every 6 hours

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  onModuleInit() {
    // Run once immediately, then on the interval
    this.runCleanup();
    setInterval(() => this.runCleanup(), CLEANUP_INTERVAL_MS);
  }

  private async runCleanup(): Promise<void> {
    try {
      const [m] = await this.ds.query(
        `DELETE FROM mqtt_metrics
         WHERE timestamp < NOW() - INTERVAL '${METRICS_RETENTION_DAYS} days'
         RETURNING id`,
      );
      const [t] = await this.ds.query(
        `DELETE FROM telemetry_events
         WHERE "createdAt" < NOW() - INTERVAL '${TELEMETRY_RETENTION_DAYS} days'
         RETURNING id`,
      );
      const mCount = Array.isArray(m) ? m.length : 0;
      const tCount = Array.isArray(t) ? t.length : 0;
      if (mCount + tCount > 0) {
        this.logger.log(
          `Retention cleanup: removed ${mCount} metric rows, ${tCount} telemetry rows`,
        );
      }
    } catch (err) {
      this.logger.warn('Retention cleanup failed', err);
    }
  }

  async recordMessage(vehicleId: string, processingTimeMs: number): Promise<void> {
    await this.ds.query(
      `INSERT INTO mqtt_metrics (id, "vehicleId", "processingTimeMs", timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [randomUUID(), vehicleId, processingTimeMs],
    );
  }

  async getStats60s(): Promise<MqttStats> {
    const rows: Array<{ count: string; avg_latency: string | null }> =
      await this.ds.query(
        `SELECT COUNT(*)::int AS count, AVG("processingTimeMs") AS avg_latency
         FROM mqtt_metrics
         WHERE timestamp > NOW() - INTERVAL '60 seconds'`,
      );

    return {
      messagesLast60s: rows[0].count ? parseInt(rows[0].count, 10) : 0,
      avgLatencyMs:    rows[0].avg_latency ? parseFloat(rows[0].avg_latency) : 0,
    };
  }
}
