import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idempotent migration — safe to run against both a fresh DB and one that
 * already has the telemetry_events table from the old synchronize:true setup.
 *
 * Key additions over the plain TypeORM schema:
 *   • PostGIS extension
 *   • geometry(Point,4326) column on telemetry_events
 *   • GIST spatial index
 *   • Backfill of existing rows from lat/lng columns
 */
export class InitPostgis1700000000000 implements MigrationInterface {
  name = 'InitPostgis1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. PostGIS ──────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    // ── 2. Base table (no-op if already created by old synchronize mode) ───
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "telemetry_events" (
        "id"         uuid              NOT NULL,
        "vehicleId"  character varying NOT NULL,
        "lat"        double precision  NOT NULL,
        "lng"        double precision  NOT NULL,
        "speed"      double precision  NOT NULL,
        "battery"    double precision  NOT NULL,
        "status"     character varying NOT NULL,
        "timestamp"  TIMESTAMPTZ       NOT NULL,
        "createdAt"  TIMESTAMPTZ       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_telemetry_events" PRIMARY KEY ("id")
      )
    `);

    // ── 3. Geometry column (safe add — skipped if already exists) ───────────
    await queryRunner.query(`
      ALTER TABLE "telemetry_events"
        ADD COLUMN IF NOT EXISTS "location" geometry(Point, 4326)
    `);

    // ── 4. Back-fill location from existing lat/lng rows ───────────────────
    await queryRunner.query(`
      UPDATE "telemetry_events"
         SET "location" = ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)
       WHERE "location" IS NULL
    `);

    // ── 5. Composite B-tree index for per-vehicle history queries ───────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_telemetry_vehicle_time"
        ON "telemetry_events" ("vehicleId", "timestamp" DESC)
    `);

    // ── 6. GIST spatial index ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_telemetry_location"
        ON "telemetry_events" USING GIST ("location")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_telemetry_location"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_telemetry_vehicle_time"`);
    await queryRunner.query(`
      ALTER TABLE "telemetry_events" DROP COLUMN IF EXISTS "location"
    `);
    // NOTE: we intentionally do not drop the PostGIS extension or the table
    // since other data may depend on them.
  }
}
