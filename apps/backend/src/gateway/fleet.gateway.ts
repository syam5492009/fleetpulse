import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true },
})
export class FleetGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(FleetGateway.name);

  @WebSocketServer()
  server: Server;

  private connected = 0;

  handleConnection(_client: Socket) {
    this.connected++;
    this.logger.log(`WS client connected. Total: ${this.connected}`);
  }

  handleDisconnect(_client: Socket) {
    this.connected--;
    this.logger.log(`WS client disconnected. Total: ${this.connected}`);
  }

  broadcastVehicleUpdate(data: object) {
    this.server.emit('vehicle:update', data);
  }
}
