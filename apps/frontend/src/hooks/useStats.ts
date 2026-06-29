'use client';

import { useEffect, useRef, useState } from 'react';

export interface FleetStats {
  vehiclesTotal:   number;
  vehiclesOnline:  number;
  vehiclesAlert:   number;
  messagesLast60s: number;
  avgLatencyMs:    number;
}

const EMPTY: FleetStats = {
  vehiclesTotal:   0,
  vehiclesOnline:  0,
  vehiclesAlert:   0,
  messagesLast60s: 0,
  avgLatencyMs:    0,
};

export function useStats(): FleetStats {
  const [stats, setStats] = useState<FleetStats>(EMPTY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

    async function fetchStats() {
      try {
        const res = await fetch(apiUrl + '/stats');
        if (res.ok) setStats(await res.json() as FleetStats);
      } catch {
        // silently ignore — stale data shown until next successful fetch
      }
    }

    fetchStats();
    timerRef.current = setInterval(fetchStats, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return stats;
}
