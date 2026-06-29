import { Module } from '@nestjs/common';
import { FleetGateway } from './fleet.gateway';

@Module({
  providers: [FleetGateway],
  exports: [FleetGateway],
})
export class GatewayModule {}
