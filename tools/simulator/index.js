#!/usr/bin/env node
'use strict';

const mqtt = require('mqtt');

const BROKER      = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const INTERVAL_MS = 2000;

/* Road waypoints for 5 Indian cities — each route traces a real road corridor */
const ROUTES = {
  VH001: [   // Delhi: NH48 Gurugram corridor
    [28.4727, 77.0709],   // IFFCO Chowk
    [28.4895, 77.0810],   // Sector 40 Gurugram
    [28.5041, 77.0930],   // Hero Honda Chowk
    [28.5212, 77.1068],   // Golf Course Road
    [28.5355, 77.1237],   // Sikanderpur
    [28.5500, 77.1400],   // Udyog Vihar
    [28.5637, 77.1545],   // Rajiv Chowk Gurugram
  ],
  VH002: [   // Mumbai: Western Express Highway
    [19.0596, 72.8378],   // Bandra
    [19.0760, 72.8481],   // Santacruz
    [19.0916, 72.8579],   // Vile Parle
    [19.1103, 72.8659],   // Andheri East
    [19.1197, 72.8636],   // Jogeshwari
    [19.1393, 72.8506],   // Goregaon
    [19.1580, 72.8483],   // Malad
  ],
  VH003: [   // Bangalore: Hosur Road / Electronic City Flyover
    [12.8434, 77.6754],   // Electronic City Phase 1
    [12.8568, 77.6701],   // Electronic City Phase 2
    [12.8700, 77.6620],   // Bommasandra
    [12.8871, 77.6495],   // Singasandra
    [12.9050, 77.6380],   // Kudlu
    [12.9220, 77.6280],   // Silk Board
    [12.9350, 77.6195],   // BTM Layout
  ],
  VH004: [   // Chennai: Anna Salai (Mount Road) & GST Road
    [13.0688, 80.2491],   // Chennai Central
    [13.0543, 80.2423],   // Nandanam
    [13.0392, 80.2363],   // Guindy
    [13.0234, 80.2184],   // Little Mount
    [13.0127, 80.2037],   // St. Thomas Mount
    [13.0008, 80.1922],   // Pallavaram
    [12.9878, 80.1823],   // Chromepet
  ],
  VH005: [   // Hyderabad: PVNR Expressway / Outer Ring Road
    [17.4328, 78.3511],   // Gachibowli
    [17.4435, 78.3772],   // HiTec City
    [17.4523, 78.3908],   // Madhapur
    [17.4655, 78.4006],   // Jubilee Hills
    [17.4795, 78.4194],   // Banjara Hills
    [17.4944, 78.4404],   // Somajiguda
    [17.5063, 78.4630],   // Begumpet
  ],
};

const vehicles = [
  { vehicleId: 'VH001', lat: ROUTES.VH001[0][0], lng: ROUTES.VH001[0][1], speed: 55,  battery: 88,  charging: false, waypointIdx: 0, direction: 1 },
  { vehicleId: 'VH002', lat: ROUTES.VH002[0][0], lng: ROUTES.VH002[0][1], speed: 80,  battery: 62,  charging: false, waypointIdx: 0, direction: 1 },
  { vehicleId: 'VH003', lat: ROUTES.VH003[0][0], lng: ROUTES.VH003[0][1], speed: 30,  battery: 28,  charging: false, waypointIdx: 0, direction: 1 },
  { vehicleId: 'VH004', lat: ROUTES.VH004[0][0], lng: ROUTES.VH004[0][1], speed: 0,   battery: 95,  charging: false, waypointIdx: 0, direction: 1 },
  { vehicleId: 'VH005', lat: ROUTES.VH005[0][0], lng: ROUTES.VH005[0][1], speed: 125, battery: 50,  charging: false, waypointIdx: 0, direction: 1 },
];

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/* Move vehicle along its road waypoints; reverse direction at endpoints */
function moveAlongRoute(v) {
  const route  = ROUTES[v.vehicleId];
  const target = route[v.waypointIdx];
  const dlat   = target[0] - v.lat;
  const dlng   = target[1] - v.lng;
  const dist   = Math.sqrt(dlat * dlat + dlng * dlng);

  const STEP = 0.0004;   // ~44 m per 2-second tick

  if (dist < STEP * 0.5) {
    // advance to next waypoint; bounce at endpoints
    v.waypointIdx += v.direction;
    if (v.waypointIdx >= route.length) { v.waypointIdx = route.length - 2; v.direction = -1; }
    if (v.waypointIdx < 0)             { v.waypointIdx = 1;                v.direction =  1; }
  } else {
    v.lat += (dlat / dist) * STEP;
    v.lng += (dlng / dist) * STEP;
  }
}

function updateSpeed(v) {
  v.speed = clamp(v.speed + (Math.random() - 0.5) * 24, 0, 160);
}

function updateBattery(v) {
  if (v.charging) {
    v.battery = clamp(v.battery + Math.random() * 1.5, 0, 100);
    if (v.battery >= 90) v.charging = false;
  } else {
    v.battery = clamp(v.battery - Math.random() * 0.4, 0, 100);
    if (v.battery < 15)  v.charging = true;
  }
}

function deriveStatus(battery, speed) {
  if (battery < 5)                    return 'offline';
  if (battery < 20 || speed > 120)    return 'alert';
  return 'online';
}

const client = mqtt.connect(BROKER);

client.on('connect', () => {
  console.log(`[simulator] Connected to ${BROKER}`);
  console.log(`[simulator] Publishing telemetry for ${vehicles.length} vehicles (India routes) every ${INTERVAL_MS}ms`);

  setInterval(() => {
    vehicles.forEach((v) => {
      moveAlongRoute(v);
      updateSpeed(v);
      updateBattery(v);

      const payload = {
        vehicleId: v.vehicleId,
        lat:       +v.lat.toFixed(6),
        lng:       +v.lng.toFixed(6),
        speed:     +v.speed.toFixed(1),
        battery:   +v.battery.toFixed(1),
        status:    deriveStatus(v.battery, v.speed),
        timestamp: new Date().toISOString(),
      };

      client.publish(`fleet/vehicles/${v.vehicleId}`, JSON.stringify(payload), { qos: 0 });
    });
  }, INTERVAL_MS);
});

client.on('error', (err) => console.error('[simulator] MQTT error:', err.message));
client.on('close', ()     => console.log('[simulator] Disconnected from broker'));
