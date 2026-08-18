import { describe, it, expect } from 'vitest';
import { getSolarMetrics } from '../../utils/solarMetrics';

describe('solar metrics', () => {
  it('derives the dashboard values from master and slave readings', () => {
    expect(getSolarMetrics(
      { pvPower: 1200, battPower: 300, battSoc: 82.5, meterPower: -500 },
      { pvPower: 800 },
    )).toEqual({
      solarProduction: 2000,
      houseConsumption: 2800,
      batteryPower: 300,
      batterySoc: 82.5,
      gridPower: -500,
    });
  });

  it('leaves house consumption unavailable when the meter is missing', () => {
    expect(getSolarMetrics({ pvPower: 1200 }, {})).toMatchObject({
      solarProduction: 1200,
      houseConsumption: null,
      batteryPower: null,
      batterySoc: null,
      gridPower: null,
    });
  });
});
