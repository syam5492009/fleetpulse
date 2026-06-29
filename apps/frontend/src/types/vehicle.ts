export interface Vehicle {
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number;
  battery: number;
  status: 'online' | 'offline' | 'alert';
  timestamp: string;
}

export interface Alert {
  vehicleId: string;
  type: 'LOW_BATTERY' | 'HIGH_SPEED';
  value: number;
  timestamp: string;
}
