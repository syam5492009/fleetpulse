'use client';

import { Vehicle } from '@/types/vehicle';

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  alert: 'Alert',
};

const STATUS_DOT: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-500',
  alert: 'bg-red-500',
};

interface Props {
  vehicles: Vehicle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function BatteryBar({ value }: { value: number }) {
  const color = value < 20 ? 'bg-red-500' : value < 50 ? 'bg-yellow-400' : 'bg-green-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-slate-600 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs text-slate-400">{value.toFixed(0)}%</span>
    </div>
  );
}

export default function VehicleSidebar({ vehicles, selectedId, onSelect }: Props) {
  const sorted = [...vehicles].sort((a, b) => {
    const order = { alert: 0, offline: 1, online: 2 };
    return (order[a.status] ?? 2) - (order[b.status] ?? 2);
  });

  return (
    <aside className="flex flex-col w-full h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Vehicles</h2>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-slate-700/50">
        {sorted.length === 0 && (
          <li className="px-4 py-6 text-sm text-slate-500 text-center">
            Waiting for vehicles…
          </li>
        )}
        {sorted.map((v) => {
          const isSelected = v.vehicleId === selectedId;
          return (
            <li
              key={v.vehicleId}
              onClick={() => onSelect(v.vehicleId)}
              className={`px-4 py-3 cursor-pointer transition-colors ${
                isSelected ? 'bg-slate-700' : 'hover:bg-slate-750'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[v.status] ?? 'bg-gray-500'}`}
                  />
                  <span className="font-medium text-sm text-slate-100">{v.vehicleId}</span>
                </div>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    v.status === 'alert'
                      ? 'bg-red-900/60 text-red-300'
                      : v.status === 'offline'
                      ? 'bg-slate-700 text-slate-400'
                      : 'bg-green-900/60 text-green-300'
                  }`}
                >
                  {STATUS_LABELS[v.status] ?? v.status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {v.speed.toFixed(1)} <span className="text-slate-500">km/h</span>
                </span>
                <BatteryBar value={v.battery} />
              </div>

              <div className="text-xs text-slate-600 mt-1">
                {new Date(v.timestamp).toLocaleTimeString()}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
