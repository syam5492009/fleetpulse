'use client';

import { FleetStats } from '@/hooks/useStats';

interface Props {
  stats: FleetStats;
}

interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;   // tailwind text colour class
  dot?: string;     // optional dot colour (bg-*)
}

function StatTile({ label, value, sub, accent, dot }: StatTileProps) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-1.5">
      {dot && <span className={'w-2 h-2 rounded-full shrink-0 ' + dot} />}
      <div>
        <div className={'text-sm font-bold tabular-nums leading-tight ' + accent}>
          {value}
          {sub && <span className="text-xs font-normal ml-1 text-slate-400">{sub}</span>}
        </div>
        <div className="text-[10px] text-slate-500 leading-tight uppercase tracking-wide">
          {label}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-slate-700 shrink-0" />;
}

export default function StatsBar({ stats }: Props) {
  const latency = stats.avgLatencyMs.toFixed(1);

  return (
    <div className="flex items-center bg-slate-900 border-b border-slate-700/60 overflow-x-auto shrink-0">
      <StatTile
        label="Online"
        value={stats.vehiclesOnline}
        accent="text-emerald-400"
        dot="bg-emerald-400"
      />
      <Divider />
      <StatTile
        label="Alert"
        value={stats.vehiclesAlert}
        accent={stats.vehiclesAlert > 0 ? 'text-red-400' : 'text-slate-400'}
        dot={stats.vehiclesAlert > 0 ? 'bg-red-400 animate-pulse' : 'bg-slate-600'}
      />
      <Divider />
      <StatTile
        label="Msgs / 60 s"
        value={stats.messagesLast60s}
        accent="text-blue-400"
      />
      <Divider />
      <StatTile
        label="Avg latency"
        value={latency}
        sub="ms"
        accent={
          stats.avgLatencyMs < 10  ? 'text-emerald-400' :
          stats.avgLatencyMs < 50  ? 'text-yellow-400'  :
                                     'text-red-400'
        }
      />
      <Divider />
      <StatTile
        label="Total tracked"
        value={stats.vehiclesTotal}
        accent="text-slate-300"
      />

      {/* live indicator — right-aligned */}
      <div className="ml-auto px-4 flex items-center gap-1.5 text-[10px] text-slate-500 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        LIVE
      </div>
    </div>
  );
}
