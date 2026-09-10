import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = resolve(__dirname, '../../../config/shelly.json');

const mockEmitInverterData = jest.fn();
const mockEmitDeviceUpdate = jest.fn();
const mockEmitFlowData = jest.fn();

jest.unstable_mockModule('../../socket.js', () => ({
  emitInverterData: mockEmitInverterData,
  emitDeviceUpdate: mockEmitDeviceUpdate,
  emitFlowData: mockEmitFlowData,
}));

const mockFlowCreate = jest.fn().mockResolvedValue({});
const mockFlowFindFirst = jest.fn().mockResolvedValue(null);
const mockQueryRaw = jest.fn().mockResolvedValue([{ pulses: 0 }]);

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: {
    flowReading: { create: mockFlowCreate, findFirst: mockFlowFindFirst },
    $queryRawUnsafe: mockQueryRaw,
  },
  configurePassport: jest.fn(),
}));

const validConfig = {
  server: 'https://shelly-263-eu.shelly.cloud',
  apiKey: 'test-api-key',
  groups: [],
  devices: [
    { id: 'luces-entrada', shellyId: '30c6f78a406c', name: 'Luces Entrada', room: 'Finca', channel: 1, group: 'lights' },
    { id: 'focos-explanada', shellyId: '30c6f78a406c', name: 'Focos explanada', room: 'Finca', channel: 0, group: 'lights' },
    {
      id: 'caudal-deposito',
      shellyId: 'plus-uni-1',
      name: 'Entrada de agua al depósito',
      room: 'Depósito',
      group: 'water',
      kind: 'sensor',
      sensor: { type: 'flow', input: 2, pulsesPerLitre: 450, maxLitresPerMinute: 200 },
    },
  ],
};

let originalConfigContent = null;

describe('Ingestion Routes', () => {
  let app;

  beforeAll(() => {
    if (existsSync(CONFIG_FILE)) {
      originalConfigContent = readFileSync(CONFIG_FILE, 'utf-8');
    }
  });

  afterAll(() => {
    if (originalConfigContent !== null) {
      writeFileSync(CONFIG_FILE, originalConfigContent);
    } else {
      try { unlinkSync(CONFIG_FILE); } catch {}
    }
  });

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    mockEmitInverterData.mockReset();
    mockEmitDeviceUpdate.mockReset();
    mockEmitFlowData.mockReset();
    mockFlowCreate.mockReset().mockResolvedValue({});
    mockFlowFindFirst.mockReset().mockResolvedValue(null);
    mockQueryRaw.mockReset().mockResolvedValue([{ pulses: 0 }]);
    writeFileSync(CONFIG_FILE, JSON.stringify(validConfig));

    process.env.INGESTION_API_KEY = 'test-key';

    const { _reset } = await import('../../services/shellyLocalStatus.js');
    _reset();

    const { _reset: resetFlow } = await import('../../services/flowStatus.js');
    resetFlow();

    const { default: ingestionRoutes } = await import('../../routes/ingestion.js');
    app = express();
    app.use(express.json());
    app.use('/api/ingestion', ingestionRoutes);
  });

  describe('POST /api/ingestion/device', () => {
    it('returns 401 without API key', async () => {
      const res = await request(app)
        .post('/api/ingestion/device')
        .send({ devices: [{ shellyId: '30c6f78a406c', online: true, relays: [{ on: true }] }] });

      expect(res.status).toBe(401);
    });

    it('returns 400 when devices is missing', async () => {
      const res = await request(app)
        .post('/api/ingestion/device')
        .set('x-api-key', 'test-key')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when devices is empty array', async () => {
      const res = await request(app)
        .post('/api/ingestion/device')
        .set('x-api-key', 'test-key')
        .send({ devices: [] });

      expect(res.status).toBe(400);
    });

    it('stores device statuses and emits device:updated per Dispositivo', async () => {
      const res = await request(app)
        .post('/api/ingestion/device')
        .set('x-api-key', 'test-key')
        .send({
          devices: [
            {
              shellyId: '30c6f78a406c',
              online: true,
              relays: [{ on: true }, { on: false }],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.stored).toBe(1);

      expect(mockEmitDeviceUpdate).toHaveBeenCalledTimes(2);
      expect(mockEmitDeviceUpdate).toHaveBeenCalledWith({ id: 'focos-explanada', on: true, online: true, source: 'local' });
      expect(mockEmitDeviceUpdate).toHaveBeenCalledWith({ id: 'luces-entrada', on: false, online: true, source: 'local' });
    });

    it('handles unknown shellyId gracefully (no emit)', async () => {
      const res = await request(app)
        .post('/api/ingestion/device')
        .set('x-api-key', 'test-key')
        .send({
          devices: [
            { shellyId: 'unknown-id', online: true, relays: [{ on: true }] },
          ],
        });

      expect(res.status).toBe(200);
      expect(mockEmitDeviceUpdate).not.toHaveBeenCalled();
    });

    it('handles offline device (emits online:false)', async () => {
      const res = await request(app)
        .post('/api/ingestion/device')
        .set('x-api-key', 'test-key')
        .send({
          devices: [
            { shellyId: '30c6f78a406c', online: false, relays: [{ on: null }, { on: null }] },
          ],
        });

      expect(res.status).toBe(200);
      expect(mockEmitDeviceUpdate).toHaveBeenCalledWith({ id: 'focos-explanada', on: null, online: false, source: 'local' });
      expect(mockEmitDeviceUpdate).toHaveBeenCalledWith({ id: 'luces-entrada', on: null, online: false, source: 'local' });
    });

    it('accepts timestamp field', async () => {
      const res = await request(app)
        .post('/api/ingestion/device')
        .set('x-api-key', 'test-key')
        .send({
          timestamp: '2026-07-16T10:00:00Z',
          devices: [
            { shellyId: '30c6f78a406c', online: true, relays: [{ on: true }, { on: true }] },
          ],
        });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/ingestion/flow', () => {
    const post = (body) => request(app).post('/api/ingestion/flow').set('x-api-key', 'test-key').send(body);

    const reading = (total, extra = {}) => ({
      shellyId: 'plus-uni-1',
      input: 2,
      online: true,
      counts: { total, by_minute: [0, 0, 0], minute_ts: 1757498400 },
      freq: 0,
      ...extra,
    });

    it('returns 401 without API key', async () => {
      const res = await request(app).post('/api/ingestion/flow').send({ sensors: [reading(10)] });
      expect(res.status).toBe(401);
    });

    it('returns 400 when sensors is missing', async () => {
      const res = await post({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when sensors is an empty array', async () => {
      const res = await post({ sensors: [] });
      expect(res.status).toBe(400);
    });

    it('stores the first reading with delta 0 (no baseline yet)', async () => {
      const res = await post({ timestamp: '2026-09-10T10:00:00.000Z', sensors: [reading(1000)] });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ stored: 1 });
      expect(mockFlowCreate).toHaveBeenCalledTimes(1);
      expect(mockFlowCreate.mock.calls[0][0].data).toMatchObject({
        sensorId: 'caudal-deposito',
        pulsesTotal: 1000,
        pulsesDelta: 0,
        counterReset: false,
        online: true,
      });
    });

    it('computes the delta against the previous reading', async () => {
      await post({ timestamp: '2026-09-10T10:00:00.000Z', sensors: [reading(1000)] });
      await post({ timestamp: '2026-09-10T10:00:30.000Z', sensors: [reading(1090)] });

      expect(mockFlowCreate).toHaveBeenCalledTimes(2);
      expect(mockFlowCreate.mock.calls[1][0].data).toMatchObject({
        pulsesTotal: 1090,
        pulsesDelta: 90,
        counterReset: false,
      });
    });

    it('reads the baseline from the database on a cold cache', async () => {
      mockFlowFindFirst.mockResolvedValueOnce({ pulsesTotal: 500, timestamp: new Date('2026-09-10T09:59:30.000Z') });

      await post({ timestamp: '2026-09-10T10:00:00.000Z', sensors: [reading(560)] });

      expect(mockFlowCreate.mock.calls[0][0].data).toMatchObject({ pulsesTotal: 560, pulsesDelta: 60 });
    });

    it('flags a counter reset and attributes the whole total', async () => {
      await post({ timestamp: '2026-09-10T10:00:00.000Z', sensors: [reading(1000)] });
      await post({ timestamp: '2026-09-10T10:00:30.000Z', sensors: [reading(40)] });

      expect(mockFlowCreate.mock.calls[1][0].data).toMatchObject({
        pulsesTotal: 40,
        pulsesDelta: 40,
        counterReset: true,
      });
    });

    it('stores an offline row with delta 0 when the sensor is unreachable', async () => {
      await post({ timestamp: '2026-09-10T10:00:00.000Z', sensors: [reading(1000)] });
      const res = await post({
        timestamp: '2026-09-10T10:00:30.000Z',
        sensors: [{ shellyId: 'plus-uni-1', input: 2, online: false }],
      });

      expect(res.status).toBe(201);
      expect(mockFlowCreate.mock.calls[1][0].data).toMatchObject({
        pulsesTotal: 1000,
        pulsesDelta: 0,
        online: false,
        freqHz: null,
      });
    });

    it('emits flow:data with the sensor summary', async () => {
      mockQueryRaw.mockResolvedValue([{ pulses: 4500 }]);
      await post({ timestamp: '2026-09-10T10:00:00.000Z', sensors: [reading(1000)] });
      mockEmitFlowData.mockClear();
      await post({ timestamp: '2026-09-10T10:00:30.000Z', sensors: [reading(1225, { freq: 75 })] });

      expect(mockEmitFlowData).toHaveBeenCalledTimes(1);
      const [summaries] = mockEmitFlowData.mock.calls[0];
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        sensorId: 'caudal-deposito',
        name: 'Entrada de agua al depósito',
        online: true,
        todayLitres: 10,
        rateLpm: 10,
      });
    });

    it('ignores entries with no declared sensor', async () => {
      const res = await post({ sensors: [{ shellyId: 'unknown', input: 2, online: true, counts: { total: 5 } }] });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ stored: 0 });
      expect(mockFlowCreate).not.toHaveBeenCalled();
      expect(mockEmitFlowData).not.toHaveBeenCalled();
    });
  });
});
