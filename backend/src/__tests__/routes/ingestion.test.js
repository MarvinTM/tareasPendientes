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

jest.unstable_mockModule('../../socket.js', () => ({
  emitInverterData: mockEmitInverterData,
  emitDeviceUpdate: mockEmitDeviceUpdate,
}));

const validConfig = {
  server: 'https://shelly-263-eu.shelly.cloud',
  apiKey: 'test-api-key',
  groups: [],
  devices: [
    { id: 'luces-entrada', shellyId: '30c6f78a406c', name: 'Luces Entrada', room: 'Finca', channel: 1, group: 'lights' },
    { id: 'focos-explanada', shellyId: '30c6f78a406c', name: 'Focos explanada', room: 'Finca', channel: 0, group: 'lights' },
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
    writeFileSync(CONFIG_FILE, JSON.stringify(validConfig));

    process.env.INGESTION_API_KEY = 'test-key';

    const { _reset } = await import('../../services/shellyLocalStatus.js');
    _reset();

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
      expect(mockEmitDeviceUpdate).toHaveBeenCalledWith({ id: 'focos-explanada', on: true, online: true });
      expect(mockEmitDeviceUpdate).toHaveBeenCalledWith({ id: 'luces-entrada', on: false, online: true });
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
      expect(mockEmitDeviceUpdate).toHaveBeenCalledWith({ id: 'focos-explanada', on: null, online: false });
      expect(mockEmitDeviceUpdate).toHaveBeenCalledWith({ id: 'luces-entrada', on: null, online: false });
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
});