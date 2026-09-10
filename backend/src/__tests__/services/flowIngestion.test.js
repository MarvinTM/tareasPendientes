import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockCreate = jest.fn().mockResolvedValue({});
const mockFindFirst = jest.fn().mockResolvedValue(null);
const mockQueryRaw = jest.fn().mockResolvedValue([{ pulses: 0 }]);

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: {
    flowReading: { create: mockCreate, findFirst: mockFindFirst },
    $queryRawUnsafe: mockQueryRaw,
  },
  configurePassport: jest.fn(),
}));

const sensorDevice = {
  id: 'caudal-deposito',
  name: 'Entrada de agua al depósito',
  kind: 'sensor',
  sensor: { type: 'flow', input: 2, pulsesPerLitre: 450, maxLitresPerMinute: 200 },
};

const counts = (total) => ({ online: true, counts: { total }, freq: null });

describe('Flow ingestion service', () => {
  let ingestFlowReading;
  let flowStatus;

  beforeEach(async () => {
    jest.resetModules();
    mockCreate.mockReset().mockResolvedValue({});
    mockFindFirst.mockReset().mockResolvedValue(null);
    mockQueryRaw.mockReset().mockResolvedValue([{ pulses: 0 }]);

    flowStatus = await import('../../services/flowStatus.js');
    flowStatus._reset();
    ({ ingestFlowReading } = await import('../../services/flowIngestion.js'));
  });

  const storedData = (call = 0) => mockCreate.mock.calls[call][0].data;

  it('discards a delta above maxLitresPerMinute but keeps the raw total', async () => {
    // 450 p/L, 30 s apart: 90_000 pulses ≈ 200 L in half a minute ≈ 400 L/min.
    mockFindFirst.mockResolvedValueOnce({ pulsesTotal: 1000, timestamp: new Date('2026-09-10T10:00:00.000Z') });

    const summary = await ingestFlowReading(sensorDevice, counts(91000), new Date('2026-09-10T10:00:30.000Z'));

    expect(storedData()).toMatchObject({ pulsesTotal: 91000, pulsesDelta: 0 });
    expect(summary.pulsesDelta).toBe(0);
  });

  it('keeps a delta just below the plausibility limit', async () => {
    // 100 L in 30 s = 200 L/min, exactly at the limit → accepted.
    mockFindFirst.mockResolvedValueOnce({ pulsesTotal: 1000, timestamp: new Date('2026-09-10T10:00:00.000Z') });

    await ingestFlowReading(sensorDevice, counts(46000), new Date('2026-09-10T10:00:30.000Z'));

    expect(storedData()).toMatchObject({ pulsesDelta: 45000 });
  });

  it('does not apply the guard when the sensor has no limit configured', async () => {
    mockFindFirst.mockResolvedValueOnce({ pulsesTotal: 1000, timestamp: new Date('2026-09-10T10:00:00.000Z') });
    const noLimit = { ...sensorDevice, sensor: { ...sensorDevice.sensor, maxLitresPerMinute: 0 } };

    await ingestFlowReading(noLimit, counts(91000), new Date('2026-09-10T10:00:30.000Z'));

    expect(storedData()).toMatchObject({ pulsesDelta: 90000 });
  });

  it('derives the rate from freq when the device reports it', async () => {
    const summary = await ingestFlowReading(
      sensorDevice,
      { online: true, counts: { total: 1000 }, freq: 75 },
      new Date('2026-09-10T10:00:00.000Z')
    );

    // 75 Hz × 60 / 450 p/L = 10 L/min
    expect(summary.rateLpm).toBe(10);
    expect(storedData().freqHz).toBe(75);
  });

  it('falls back to the delta over elapsed time when freq is missing', async () => {
    mockFindFirst.mockResolvedValueOnce({ pulsesTotal: 1000, timestamp: new Date('2026-09-10T10:00:00.000Z') });

    // 4500 pulses = 10 L in 30 s → 20 L/min
    const summary = await ingestFlowReading(sensorDevice, counts(5500), new Date('2026-09-10T10:00:30.000Z'));

    expect(summary.rateLpm).toBe(20);
  });

  it('derives today litres from the stored pulses', async () => {
    mockQueryRaw.mockResolvedValue([{ pulses: 9000 }]);

    const summary = await ingestFlowReading(sensorDevice, counts(9000), new Date('2026-09-10T10:00:00.000Z'));

    expect(summary.todayLitres).toBe(20);
  });

  it('keeps the reading when the today aggregate fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('db down'));

    const summary = await ingestFlowReading(sensorDevice, counts(1000), new Date('2026-09-10T10:00:00.000Z'));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(summary.todayLitres).toBeNull();
  });

  it('caches the status so the next reading needs no database baseline', async () => {
    await ingestFlowReading(sensorDevice, counts(1000), new Date('2026-09-10T10:00:00.000Z'));
    mockFindFirst.mockClear();

    await ingestFlowReading(sensorDevice, counts(1450), new Date('2026-09-10T10:00:30.000Z'));

    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(storedData(1)).toMatchObject({ pulsesDelta: 450 });
    expect(flowStatus.getFlowStatus('caudal-deposito')).toMatchObject({ online: true });
  });

  it('stores an offline row and keeps the previous baseline', async () => {
    await ingestFlowReading(sensorDevice, counts(1000), new Date('2026-09-10T10:00:00.000Z'));
    await ingestFlowReading(sensorDevice, { online: false }, new Date('2026-09-10T10:00:30.000Z'));

    expect(storedData(1)).toMatchObject({ pulsesTotal: 1000, pulsesDelta: 0, online: false });
    expect(flowStatus.getFlowStatus('caudal-deposito')).toMatchObject({ online: false, rateLpm: null });

    // The counter baseline survives the outage, so the next delta is correct.
    await ingestFlowReading(sensorDevice, counts(1450), new Date('2026-09-10T10:01:00.000Z'));
    expect(storedData(2)).toMatchObject({ pulsesDelta: 450 });
  });

  it('treats an online reading without counts as offline', async () => {
    await ingestFlowReading(sensorDevice, { online: true, freq: 2 }, new Date('2026-09-10T10:00:00.000Z'));

    expect(storedData()).toMatchObject({ pulsesDelta: 0, online: false });
  });
});
