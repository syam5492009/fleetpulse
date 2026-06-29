# FleetPulse

FleetPulse is a real-time fleet tracking platform that ingests vehicle telemetry over MQTT, persists it in PostGIS-enabled PostgreSQL, and streams live position updates to a Next.js dashboard over WebSocket. It is designed for Indian road networks and uses OSRM map matching to snap GPS traces onto actual road geometry.

---

## Architecture

```
  [ Vehicle Simulators ]
         |
         | MQTT  (fleet/vehicles/+)
         v
  +-------------------+
  |  Mosquitto Broker |  :1883
  +-------------------+
         |
         v
  +-------------------+    raw positions    +----------+
  |  NestJS Backend   | ------------------> |  Redis   |  :6379
  |                   |                     +----------+
  |  MQTT Service     |    telemetry +        +----------+
  |  Metrics Logger   | -- route geometry -> | Postgres |  :5432
  |  REST API         |    (PostGIS)          | PostGIS  |
  |  WebSocket GW     |                      +----------+
  +-------------------+
         |
         | WebSocket  (socket.io  vehicle:update)
         | REST       GET /vehicles  /stats  /vehicles/:id/route
         v
  +-------------------+
  |  Next.js 14 App   |  :3000
  |                   |
  |  Leaflet Map      |
  |  StatsBar         |
  |  VehicleSidebar   |
  |  AlertPanel       |
  +-------------------+
         |
         | HTTP  (OSRM Map Matching)
         v
  [ router.project-osrm.org ]   (road-snap GPS traces)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Message broker | Eclipse Mosquitto 2 (MQTT) |
| Backend framework | NestJS 10 (TypeScript) |
| ORM / migrations | TypeORM with PostGIS geometry types |
| Spatial database | PostgreSQL 15 + PostGIS 3.4 |
| Cache / live state | Redis 7 (ioredis) |
| Real-time transport | Socket.IO WebSocket gateway |
| Map matching | OSRM public API (OpenStreetMap) |
| Frontend framework | Next.js 14 App Router + React 18 |
| Map rendering | Leaflet.js 1.9 with 5 tile layers |
| Styling | Tailwind CSS |
| Monorepo tooling | pnpm workspaces |
| Infrastructure | Docker Compose |

---

## Local Setup

### Prerequisites

- Docker Desktop (running)
- Node.js >= 20
- pnpm >= 8 (`npm i -g pnpm`)

### Start everything with one command

```bash
pnpm start
```

This will:
1. Pull and start Mosquitto, PostgreSQL/PostGIS, and Redis via Docker Compose
2. Run TypeORM migrations (PostGIS extension, telemetry table, MQTT metrics table)
3. Open labeled console windows for the NestJS backend, Next.js frontend, and vehicle simulator

### Stop

```bash
pnpm stop
```

### Manual control

```bash
# Infrastructure only
docker compose up mosquitto postgres redis -d

# Backend (NestJS on :3001)
pnpm dev:backend

# Frontend (Next.js on :3000)
pnpm dev:frontend

# Vehicle simulator (5 Indian city routes via MQTT)
pnpm dev:simulator
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://fleetpulse:fleetpulse@localhost:5432/fleetpulse` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `MQTT_BROKER` | `mqtt://localhost:1883` | MQTT broker URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend base URL (frontend) |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/vehicles` | All vehicle last-known positions (from Redis) |
| `GET` | `/vehicles/:id/history` | Last 100 telemetry events from PostgreSQL |
| `GET` | `/vehicles/:id/route?from=ISO&to=ISO` | GeoJSON LineString for the vehicle's path |
| `GET` | `/stats` | Live fleet stats: online count, alert count, MQTT throughput, avg latency |
| `WS` | `socket.io` | `vehicle:update` event emitted on every MQTT message |

---

## Screenshots

> Add screenshots here after first run

| Dashboard overview | Route view (road-snapped) |
|---|---|
| `docs/screenshot-dashboard.png` | `docs/screenshot-route.png` |

---

## Technical Highlights (for resume)

- **Real-time geospatial pipeline** — built an end-to-end MQTT to NestJS to PostGIS to WebSocket to Leaflet pipeline processing 150+ GPS events/minute across 5 simulated vehicles on Indian road networks, with sub-10 ms average message latency tracked per-event in PostgreSQL.

- **PostGIS road-snap integration** — integrated OSRM map matching API to convert raw GPS traces into road-following GeoJSON polylines using ST_MakeLine and ST_AsGeoJSON; vehicles that previously appeared in rivers or parks now follow actual road geometry on OpenStreetMap tile layers.

- **Production-grade monorepo** — architected a pnpm workspace with NestJS (TypeORM migrations, Redis caching, Socket.IO gateway) and Next.js 14 App Router (dynamic SSR-disabled Leaflet, ResizeObserver map sizing, React 18 StrictMode-safe marker lifecycle) orchestrated by a single PowerShell script with Docker Compose health checks and automatic port cleanup.
