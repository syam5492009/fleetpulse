'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useFleetSocket } from '@/hooks/useFleetSocket';
import { useVehicleRoute } from '@/hooks/useVehicleRoute';
import { useStats } from '@/hooks/useStats';
import VehicleSidebar from './VehicleSidebar';
import AlertPanel from './AlertPanel';
import StatsBar from './StatsBar';
import { Alert, Vehicle } from '@/types/vehicle';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

type Tab = 'map' | 'list';

export default function Dashboard() {
  const vehicles     = useFleetSocket();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<Tab>('map');
  const routeLatLngs = useVehicleRoute(selectedId);
  const stats        = useStats();

  const vehicleList = useMemo(() => Object.values(vehicles), [vehicles]);

  const alerts = useMemo<Alert[]>(() => {
    const result: Alert[] = [];
    vehicleList.forEach((v: Vehicle) => {
      if (v.battery < 20) result.push({ vehicleId: v.vehicleId, type: 'LOW_BATTERY', value: v.battery, timestamp: v.timestamp });
      if (v.speed > 120)  result.push({ vehicleId: v.vehicleId, type: 'HIGH_SPEED',  value: v.speed,   timestamp: v.timestamp });
    });
    return result;
  }, [vehicleList]);

  const alertCount = alerts.length;

  return (
    <div className="flex flex-col h-full bg-slate-900">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="5" width="9" height="6" rx="1.5" fill="white"/>
              <rect x="3" y="2.5" width="5" height="5" rx="1" fill="white" fillOpacity=".7"/>
              <circle cx="3.5" cy="11.5" r="1.5" fill="white"/>
              <circle cx="8.5" cy="11.5" r="1.5" fill="white"/>
              <rect x="10" y="7" width="5" height="4" rx="1" fill="#93c5fd"/>
            </svg>
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-tight">FleetPulse</span>
            <span className="hidden sm:inline text-xs text-slate-400 ml-2">Real-time Tracker</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {alertCount > 0 && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-950/60 border border-red-800/50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {alertCount} alert{alertCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-slate-300 bg-slate-700/60 px-2.5 py-1 rounded-full">
            {vehicleList.length} vehicle{vehicleList.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* ── Stats bar ──────────────────────────────────────────── */}
      <StatsBar stats={stats} />

      {/* ── Main: desktop = row, mobile = stacked with tabs ──── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — hidden on mobile unless list tab active */}
        <div className={`
          md:flex md:w-72 md:shrink-0 flex-col
          bg-slate-800 border-r border-slate-700
          ${activeTab === 'list' ? 'flex w-full' : 'hidden'}
        `}>
          <VehicleSidebar
            vehicles={vehicleList}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setActiveTab('map'); }}
          />
        </div>

        {/* Map — hidden on mobile unless map tab active */}
        <div className={`
          relative flex-1
          ${activeTab === 'map' ? 'flex' : 'hidden md:flex'}
        `}>
          <MapView
            vehicles={vehicles}
            selectedId={selectedId}
            onVehicleSelect={setSelectedId}
            routeLatLngs={routeLatLngs}
          />

          {/* Alert panel overlay — top-right of map */}
          {alertCount > 0 && (
            <div className="absolute top-3 right-3 z-[1000] w-72 max-w-[calc(100vw-1.5rem)]">
              <AlertPanel alerts={alerts} />
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile tab bar ─────────────────────────────────────── */}
      <nav className="md:hidden flex border-t border-slate-700 bg-slate-800 shrink-0">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
            activeTab === 'map'
              ? 'text-blue-400 border-t-2 border-blue-400'
              : 'text-slate-400 border-t-2 border-transparent'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="mb-0.5">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
          </svg>
          Map
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors relative ${
            activeTab === 'list'
              ? 'text-blue-400 border-t-2 border-blue-400'
              : 'text-slate-400 border-t-2 border-transparent'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="mb-0.5">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
          </svg>
          Vehicles
          {alertCount > 0 && (
            <span className="absolute top-1.5 right-6 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
}
