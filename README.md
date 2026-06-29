# FleetPulse

FleetPulse is a real-time fleet tracking platform that ingests vehicle telemetry over MQTT, persists it in PostGIS-enabled PostgreSQL, and streams live position updates to a Next.js dashboard over WebSocket. It is designed for Indian road networks and uses OSRM map matching to snap GPS traces onto actual road geometry.

---

## Architecture

```mermaid
flowchart TD
    subgraph Simulators["🚗 Vehicle Simulators (5 Indian Cities)"]
        S1[Delhi · NH48]
        S2[Mumbai · WEH]
        S3[Bangalore · Hosur Rd]
        S4[Chennai · Anna Salai]
        S5[Hyderabad · ORR]
    end

    subgraph Infra["🐳 Docker Compose Infrastructure"]
        MQTT[Mosquitto Broker\n:1883]
        PG[(PostgreSQL 15\n+ PostGIS 3.4\n:5432)]
        RD[(Redis 7\n:6379)]
    end

    subgraph Backend["⚙️ NestJS Backend :3001"]
        MS[MQTT Service\nsubscribes fleet/vehicles/+]
        ML[Metrics Interceptor\nlogs processingTimeMs]
        VS[Vehicles Service\nST_MakePoint · ST_MakeLine]
        RS[Redis Service\nlast-known positions]
        WS[Socket.IO Gateway\nvehicle:update events]
        API[REST API\n/vehicles · /stats · /route]
    end

    subgraph Frontend["🖥️ Next.js 14 App :3000"]
        SB[StatsBar\nonline · alert · latency]
        MAP[Leaflet Map\n5 tile layers]
        SIDEBAR[Vehicle Sidebar\nlive list + alerts]
        ROUTE[Route Polyline\nOSRM road-snapped]
    end

    OSRM[🗺️ OSRM Map Matching\nrouter.project-osrm.org]

    S1 & S2 & S3 & S4 & S5 -->|MQTT publish| MQTT
    MQTT -->|subscribe| MS
    MS --> ML
    MS --> VS
    MS --> RS
    MS --> WS
    VS -->|INSERT telemetry\nST_SetSRID ST_MakePoint| PG
    ML -->|INSERT mqtt_metrics| PG
    RS -->|SET vehicle position| RD
    WS -->|broadcast| Frontend
    API -->|query| PG
    API -->|query| RD
    Frontend -->|REST poll /stats /route| API
    Frontend -->|WebSocket| WS
    ROUTE -->|snap GPS to roads| OSRM

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
    participant PG as PostgreSQL/PostGIS
    participant WS as WebSocket
    participant FE as Next.js Frontend
    participant OSRM as OSRM API

    SIM->>MQ: publish fleet/vehicles/VH001 {lat,lng,speed,battery}
    MQ->>NJ: message event (topic + payload)
    Note over NJ: t0 = performance.now()
    par Parallel writes
        NJ->>RD: SET vehicle:VH001:position
        NJ->>PG: INSERT telemetry_events (ST_MakePoint)
    end
    NJ->>WS: emit vehicle:update
    Note over NJ: processingTimeMs = now() - t0
    NJ->>PG: INSERT mqtt_metrics (vehicleId, processingTimeMs)
    WS->>FE: vehicle:update event
    FE->>FE: update marker position on Leaflet map

    FE->>NJ: GET /stats (every 5s)
    NJ->>PG: COUNT mqtt_metrics last 60s + AVG latency
    NJ->>RD: GET all vehicle positions
    NJ-->>FE: {vehiclesOnline, vehiclesAlert, messagesLast60s, avgLatencyMs}

    FE->>NJ: GET /vehicles/VH001/route?from=...&to=...
    NJ->>PG: ST_MakeLine(location ORDER BY timestamp) → GeoJSON
    NJ-->>FE: LineString {coordinates[[lng,lat]...]}
    FE->>OSRM: match/v1/driving/lng,lat;lng,lat;...
    OSRM-->>FE: road-snapped GeoJSON geometry
    FE->>FE: draw Leaflet Polyline on roads
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

### Dashboard — Live Vehicle Tracking
![Dashboard overview showing 5 vehicles tracked across Indian cities with real-time speed, battery and alert status in the sidebar](docs/screenshots/dashboard.png)

> Dark-themed dashboard with Streets tile layer. The sidebar lists all tracked vehicles with live speed/battery indicators. VH002 is selected — its route trail (blue polyline) follows the Western Express Highway road geometry via OSRM map matching.

### Alert Panel
![Active alerts panel showing speeding vehicles with red indicators](docs/screenshots/alerts.png)

> When a vehicle exceeds 120 km/h or drops below 20% battery, a real-time alert appears in the top-right overlay. The vehicle pin pulses red on the map.

### Stats Bar
![Stats bar showing online count, alert count, messages per 60 seconds and average latency](docs/screenshots/statsbar.png)

> The stats bar (below the header) refreshes every 5 seconds: vehicles online, active alerts, MQTT message throughput in the last 60 seconds, and average processing latency measured per message.

### Road-Snapped Route Trail
![Route polyline following NH48 Delhi-Gurugram Expressway exactly on the road](docs/screenshots/route.png)

> Selecting a vehicle draws its last 30 minutes of GPS history as a road-snapped polyline. Raw GPS coordinates are sent to OSRM map matching which returns geometry that follows actual road lanes — not straight lines through fields or rivers.

> **Note:** Replace the image paths above with actual screenshots after running the project.

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
