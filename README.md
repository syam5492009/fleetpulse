# FleetPulse

FleetPulse is a real-time fleet tracking platform that ingests vehicle telemetry over MQTT, persists it in PostGIS-enabled PostgreSQL, and streams live position updates to a Next.js dashboard over WebSocket. It is designed for Indian road networks and uses OSRM map matching to snap GPS traces onto actual road geometry.

---

## Architecture

```mermaid
flowchart TD
    subgraph Simulators["Vehicle Simulators — 5 Indian Cities"]
        S1[Delhi NH48]
        S2[Mumbai WEH]
        S3[Bangalore Hosur Road]
        S4[Chennai Anna Salai]
        S5[Hyderabad ORR]
    end

    subgraph Infra["Docker Compose Infrastructure"]
        MQTT[Mosquitto Broker port 1883]
        PG[(PostgreSQL 15 plus PostGIS 3.4)]
        RD[(Redis 7)]
    end

    subgraph Backend["NestJS Backend — port 3001"]
        MS[MQTT Service]
        ML[Metrics Interceptor]
        VS[Vehicles Service]
        RS[Redis Service]
        WS[Socket.IO Gateway]
        API[REST API]
    end

    subgraph Frontend["Next.js 14 App — port 3000"]
        SB[StatsBar]
        MAP[Leaflet Map]
        SIDEBAR[Vehicle Sidebar]
        ROUTE[Route Polyline]
    end

    OSRM[OSRM Map Matching API]

    S1 & S2 & S3 & S4 & S5 -->|MQTT publish| MQTT
    MQTT -->|subscribe| MS
    MS --> ML & VS & RS & WS
    VS -->|INSERT with ST_MakePoint| PG
    ML -->|INSERT mqtt_metrics| PG
    RS -->|SET last position| RD
    WS -->|vehicle:update broadcast| Frontend
    API -->|query telemetry and route| PG
    API -->|query live positions| RD
    Frontend -->|REST poll every 5s| API
    Frontend -->|WebSocket subscribe| WS
    ROUTE -->|snap GPS coords to roads| OSRM

    style Simulators fill:#1e3a5f,color:#93c5fd,stroke:#3b82f6
    style Infra fill:#1a2e1a,color:#86efac,stroke:#22c55e
    style Backend fill:#2d1b69,color:#c4b5fd,stroke:#8b5cf6
    style Frontend fill:#1a1a2e,color:#93c5fd,stroke:#3b82f6
    style OSRM fill:#1e293b,color:#94a3b8,stroke:#475569
```

---

## Technical Architecture — Data Flow

```mermaid
sequenceDiagram
    participant SIM as Vehicle Simulator
    participant MQ as Mosquitto MQTT
    participant NJ as NestJS Backend
    participant RD as Redis
    participant PG as PostgreSQL PostGIS
    participant WS as WebSocket Gateway
    participant FE as Next.js Frontend
    participant OSRM as OSRM API

    SIM->>MQ: publish fleet/vehicles/VH001
    MQ->>NJ: message event with payload
    Note over NJ: record t0 = performance.now()
    par Parallel writes
        NJ->>RD: SET vehicle position in Redis
        NJ->>PG: INSERT telemetry with ST_MakePoint
    end
    NJ->>WS: emit vehicle update event
    Note over NJ: processingTimeMs = now minus t0
    NJ->>PG: INSERT into mqtt_metrics table
    WS->>FE: vehicle update received
    FE->>FE: move marker on Leaflet map

    FE->>NJ: GET /stats every 5 seconds
    NJ->>PG: COUNT msgs and AVG latency last 60s
    NJ->>RD: GET all vehicle positions
    NJ-->>FE: online count, alerts, throughput, latency

    FE->>NJ: GET /vehicles/VH001/route with date range
    NJ->>PG: ST_MakeLine ordered by timestamp
    NJ-->>FE: GeoJSON LineString coordinates
    FE->>OSRM: POST coordinates for road matching
    OSRM-->>FE: road-snapped GeoJSON geometry
    FE->>FE: draw Polyline following actual roads
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

## Screenshots

> Run the project locally with `pnpm start` and replace these descriptions with actual screenshots.

### Dashboard — Live Vehicle Tracking

Dark-themed dashboard with Streets tile layer. The sidebar lists all 5 tracked vehicles with live speed and battery indicators. Selecting a vehicle flies the map to its location and opens a popup with speed, battery, and timestamp.

### Alert Panel

When a vehicle exceeds 120 km/h or drops below 20% battery, a real-time alert card appears in the top-right overlay with a lightning icon. The vehicle pin on the map pulses red.

### Stats Bar

A slim bar below the header refreshes every 5 seconds showing: vehicles online (green), active alerts (red), MQTT messages in the last 60 seconds, and average processing latency in milliseconds with colour-coded health (green under 10 ms, yellow under 50 ms, red above).

### Road-Snapped Route Trail

Selecting a vehicle draws its last 30 minutes of GPS history as a blue polyline. Raw GPS coordinates are sent to OSRM map matching which returns geometry that follows actual road lanes — not straight lines through fields or rivers. The route is visible on all 5 tile layers (Dark, Streets, Light, Satellite, Topo).

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

### Other commands

```bash
pnpm restart   # stop + start
pnpm status    # check which ports are live
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

Copy `.env.example` to `.env` and adjust for your environment:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | `fleetpulse` | PostgreSQL password (change in production) |
| `DATABASE_URL` | `postgresql://fleetpulse:...@localhost:5432/fleetpulse` | Full connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `MQTT_BROKER` | `mqtt://localhost:1883` | MQTT broker URL |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend base URL (frontend) |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/vehicles` | All vehicle last-known positions (from Redis) |
| `GET` | `/vehicles/:id/history` | Last 100 telemetry events from PostgreSQL |
| `GET` | `/vehicles/:id/route?from=ISO&to=ISO` | GeoJSON LineString built with ST_MakeLine |
| `GET` | `/stats` | Live: online count, alert count, msgs/60s, avg latency |
| `WS` | `socket.io` | `vehicle:update` event on every MQTT message |

---

## Project Structure

```
fleetpulse/
├── apps/
│   ├── backend/                  # NestJS application
│   │   └── src/
│   │       ├── gateway/          # Socket.IO WebSocket gateway
│   │       ├── metrics/          # MQTT metrics entity + service
│   │       ├── migrations/       # TypeORM migrations (PostGIS, mqtt_metrics)
│   │       ├── mqtt/             # MQTT subscriber service
│   │       ├── redis/            # Redis service (last-known positions)
│   │       ├── stats/            # GET /stats controller
│   │       └── vehicles/         # Telemetry entity, service, REST controller
│   └── frontend/                 # Next.js 14 application
│       └── src/
│           ├── components/       # MapView, Dashboard, StatsBar, AlertPanel
│           ├── hooks/            # useFleetSocket, useVehicleRoute, useStats
│           └── types/            # Shared TypeScript types
├── tools/
│   └── simulator/                # Node.js MQTT vehicle simulator (5 Indian routes)
├── docker/
│   └── mosquitto/                # Mosquitto broker config
├── docker-compose.yml
├── fleetpulse.ps1                # Windows orchestrator script
└── pnpm-workspace.yaml
```

---

## Technical Highlights (for resume)

- **Real-time geospatial pipeline** — built an end-to-end MQTT → NestJS → PostGIS → WebSocket → Leaflet pipeline processing 150+ GPS events/minute across 5 simulated vehicles on Indian road networks, with per-message processing latency tracked in PostgreSQL and surfaced in a live dashboard stats bar.

- **PostGIS road-snap integration** — integrated OSRM map matching API to convert raw GPS traces into road-following GeoJSON polylines using `ST_MakeLine` and `ST_AsGeoJSON`; added automatic 7/30-day data retention cleanup to prevent unbounded table growth in long-running deployments.

- **Production-grade monorepo** — architected a pnpm workspace with NestJS (TypeORM migrations, Redis caching, Socket.IO gateway, helmet security headers, CORS env config) and Next.js 14 App Router (SSR-disabled Leaflet, ResizeObserver map sizing, React 18 StrictMode-safe marker lifecycle) orchestrated by a PowerShell script with Docker Compose health checks and automatic port cleanup.
