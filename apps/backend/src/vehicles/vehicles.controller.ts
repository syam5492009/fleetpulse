import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  getAllVehicles() {
    return this.vehiclesService.getAllVehicles();
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.vehiclesService.getHistory(id);
  }

  /**
   * GET /vehicles/:id/route?from=ISO_DATE&to=ISO_DATE
   *
   * Returns the vehicle's route as a GeoJSON LineString built with ST_MakeLine.
   * Defaults to the last hour when query params are omitted.
   *
   * Example:
   *   /vehicles/VH001/route?from=2024-01-01T00:00:00Z&to=2024-01-01T01:00:00Z
   */
  @Get(':id/route')
  async getRoute(
    @Param('id') id: string,
    @Query('from') fromStr?: string,
    @Query('to')   toStr?: string,
  ) {
    const now  = new Date();
    const from = fromStr ? new Date(fromStr) : new Date(now.getTime() - 60 * 60 * 1000);
    const to   = toStr   ? new Date(toStr)   : now;

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO 8601.');
    }
    if (from >= to) {
      throw new BadRequestException('"from" must be before "to".');
    }

    return this.vehiclesService.getRoute(id, from, to);
  }
}
