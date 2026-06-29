'use client';

import { useState } from 'react';
import { Alert } from '@/types/vehicle';

interface Props {
  alerts: Alert[];
}

export default function AlertPanel({ alerts }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter(
    (a) => !dismissed.has(`${a.vehicleId}-${a.type}`),
  );

  if (visible.length === 0) return null;

  return (
    <div className="bg-slate-800/95 backdrop-blur border border-red-800/50 rounded-lg shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-red-800/40 bg-red-950/40">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-semibold text-red-300 uppercase tracking-wider">
            {visible.length} Active Alert{visible.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <ul className="max-h-64 overflow-y-auto divide-y divide-slate-700/50">
        {visible.map((alert) => {
          const key = `${alert.vehicleId}-${alert.type}`;
          const isLowBattery = alert.type === 'LOW_BATTERY';
          return (
            <li key={key} className="flex items-start justify-between px-3 py-2.5 gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-red-400 mt-0.5 text-base leading-none flex-shrink-0">
                  {isLowBattery ? '🔋' : '⚡'}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-200">{alert.vehicleId}</div>
                  <div className="text-xs text-slate-400">
                    {isLowBattery
                      ? `Low battery: ${alert.value.toFixed(1)}%`
                      : `Speeding: ${alert.value.toFixed(1)} km/h`}
                  </div>
                  <div className="text-xs text-slate-600">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDismissed((p) => new Set([...p, key]))}
                className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 text-lg leading-none mt-0.5"
                aria-label="Dismiss"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
