'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Vehicle } from '@/types/vehicle';

export function useFleetSocket() {
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

    fetch(`${apiUrl}/vehicles`)
      .then((r) => r.json())
      .then((data: Vehicle[]) => {
        const map: Record<string, Vehicle> = {};
        data.forEach((v) => { map[v.vehicleId] = v; });
        setVehicles(map);
      })
      .catch(() => {});

    const socket = io(wsUrl, { transports: ['websocket', 'polling'] });

    socket.on('vehicle:update', (vehicle: Vehicle) => {
      setVehicles((prev) => ({ ...prev, [vehicle.vehicleId]: vehicle }));
    });

    return () => { socket.disconnect(); };
  }, []);

  return vehicles;
}
