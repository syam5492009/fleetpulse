import { MigrationInterface, QueryRunner } from 'typeorm';

export class MqttMetrics1700000000001 implements MigrationInterface {
  name = 'MqttMetrics1700000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mqtt_metrics" (
        "id"                uuid              NOT NULL,
        "vehicleId"         character varying NOT NULL,
        "processingTimeMs"  double precision  NOT NULL,
        "timestamp"         TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_mqtt_metrics" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mqtt_metrics_timestamp"
        ON "mqtt_metrics" ("timestamp" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mqtt_metrics_vehicle_time"
        ON "mqtt_metrics" ("vehicleId", "timestamp" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mqtt_metrics_vehicle_time"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mqtt_metrics_timestamp"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mqtt_metrics"`);
  }
}
