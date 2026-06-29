import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { TelemetryEvent } from './entities/telemetry.entity';
import { RedisService } from '../redis/redis.service';

export interface TelemetryPayload {
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number;
  battery: number;
  status: string;
  timestamp: string;
}

export interface RouteGeoJSON {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat] — GeoJSON convention
}

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(TelemetryEvent)
    private readonly telemetryRepo: Repository<TelemetryEvent>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  async getAllVehicles(): Promise<object[]> {
    return this.redisService.getAllVehiclePositions();
  }

  async getHistory(vehicleId: string): Promise<TelemetryEvent[]> {
    return this.telemetryRepo.find({
      where: { vehicleId },
      order: { timestamp: 'DESC' },
      take: 100,
    });
  }

  /**
   * Persist one telemetry event.
   * Uses a raw INSERT so we can write the PostGIS geometry column in the same
   * statement via ST_SetSRID(ST_MakePoint(lng, lat), 4326).
   */
  async saveTelemetry(payload: TelemetryPayload): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO telemetry_events
         (id, "vehicleId", lat, lng, speed, battery, status, timestamp, location)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8,
          ST_SetSRID(ST_MakePoint($9, $10), 4326))`,
      [
        randomUUID(),
        payload.vehicleId,
        payload.lat,
        payload.lng,
        payload.speed,
        payload.battery,
        payload.status,
        new Date(payload.timestamp),
        payload.lng,   // ST_MakePoint(lng, lat) — X = longitude, Y = latitude
        payload.lat,
      ],
    );
  }

  /**
   * Return the vehicle's route as a GeoJSON LineString.
   *
   * Uses a subquery to grab the 50 most-recent points inside the time window,
   * then ST_MakeLine collapses them into a single geometry ordered by time.
   * ST_AsGeoJSON serialises the result to the standard GeoJSON format.
   */
  async getRoute(
    vehicleId: string,
    from: Date,
    to: Date,
  ): Promise<RouteGeoJSON> {
    const rows: Array<{ geojson: string | null }> = await this.dataSource.query(
      `SELECT
         ST_AsGeoJSON(
           ST_MakeLine(sub.pt ORDER BY sub.ts ASC)
         ) AS geojson
       FROM (
         SELECT
           location  AS pt,
           timestamp AS ts
         FROM telemetry_events
         WHERE "vehicleId" = $1
           AND timestamp BETWEEN $2 AND $3
           AND location IS NOT NULL
         ORDER BY timestamp DESC
         LIMIT 500
       ) sub`,
      [vehicleId, from, to],
    );

    const raw = rows[0]?.geojson;
    if (!raw) return { type: 'LineString', coordinates: [] };

    const parsed = JSON.parse(raw) as { type: string; coordinates: unknown };
    // ST_MakeLine on a single point produces a Point, not a LineString
    if (parsed.type !== 'LineString') return { type: 'LineString', coordinates: [] };

    return parsed as RouteGeoJSON;
  }
}
