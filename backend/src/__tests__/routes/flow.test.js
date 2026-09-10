import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const authenticatedUser = { id: 'usr-1', email: 'test@test.com', name: 'Test User', isApproved: true };

const mockFindFirst = jest.fn();
const mockQueryRaw = jest.fn();

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: {
    flowReading: { findFirst: mockFindFirst },
    $queryRawUnsafe: mockQueryRaw,
  },
  configurePassport: jest.fn(),
}));

const mockGetSensorDevices = jest.fn();

jest.unstable_mockModule('../../services/shelly.js', () => ({
  getSensorDevices: mockGetSensorDevices,
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = authenticatedUser;
    next();
  }),
}));

const sensor = {
  id: 'caudal-deposito',
  name: 'Entrada de agua al depósito',
  room: 'Depósito',
  group: 'water',
  showOnHome: true,
  kind: 'sensor',
  sensor: { type: 'flow', input: 2, pulsesPerLitre: 450, maxLitresPerMinute: 200 },
};

describe('Flow Routes', () => {
  let app;
  let flowStatus;

  beforeEach(async () => {
    jest.resetModules();
    mockFindFirst.mockReset().mockResolvedValue(null);
    mockQueryRaw.mockReset().mockResolvedValue([]);
    mockGetSensorDevices.mockReset().mockReturnValue([sensor]);

    flowStatus = await import('../../services/flowStatus.js');
    flowStatus._reset();

    const { default: flowRoutes } = await import('../../routes/flow.js');
    app = express();
    app.use(express.json());
    app.use('/api/flow', flowRoutes);
  });

  describe('GET /api/flow/sensors', () => {
    it('returns an empty list when no sensor is declared', async () => {
      mockGetSensorDevices.mockReturnValue([]);

      const res = await request(app).get('/api/flow/sensors');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('reports the sensor as offline when it has no readings', async () => {
      mockQueryRaw.mockResolvedValue([{ pulses: 0 }]);

      const res = await request(app).get('/api/flow/sensors');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: 'caudal-deposito',
        name: 'Entrada de agua al depósito',
        room: 'Depósito',
        pulsesPerLitre: 450,
        online: false,
        rateLpm: null,
        todayLitres: 0,
        lastReadingAt: null,
      });
    });

    it('derives litres and rate from the last reading', async () => {
      const now = new Date();
      mockFindFirst
        .mockResolvedValueOnce({ timestamp: now, online: true })
        .mockResolvedValueOnce({ timestamp: now, freqHz: 75 });
      mockQueryRaw.mockResolvedValue([{ pulses: 4500 }]);

      const res = await request(app).get('/api/flow/sensors');

      expect(res.body[0]).toMatchObject({
        online: true,
        todayLitres: 10,
        rateLpm: 10, // 75 Hz × 60 / 450 p/L
      });
    });

    it('reports offline when the last reading is older than the freshness window', async () => {
      const stale = new Date(Date.now() - 10 * 60 * 1000);
      mockFindFirst
        .mockResolvedValueOnce({ timestamp: stale, online: true })
        .mockResolvedValueOnce({ timestamp: stale, freqHz: 75 });
      mockQueryRaw.mockResolvedValue([{ pulses: 4500 }]);

      const res = await request(app).get('/api/flow/sensors');

      expect(res.body[0]).toMatchObject({ online: false, rateLpm: null, todayLitres: 10 });
    });

    it('returns 500 when the query fails', async () => {
      mockQueryRaw.mockRejectedValue(new Error('db down'));

      const res = await request(app).get('/api/flow/sensors');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/flow/:sensorId/history', () => {
    it('returns 400 for an unsupported range', async () => {
      const res = await request(app).get('/api/flow/caudal-deposito/history?range=1y');

      expect(res.status).toBe(400);
      expect(mockQueryRaw).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown sensor', async () => {
      const res = await request(app).get('/api/flow/no-such-sensor/history?range=24h');

      expect(res.status).toBe(404);
      expect(mockQueryRaw).not.toHaveBeenCalled();
    });

    it('defaults to the 24h range and passes the calibration factor', async () => {
      mockQueryRaw.mockResolvedValue([{ time: '2026-09-10T10:00:00.000Z', litres: 3.2, avgRateLpm: 10 }]);

      const res = await request(app).get('/api/flow/caudal-deposito/history');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      const [sql, sensorId, pulsesPerLitre] = mockQueryRaw.mock.calls[0];
      expect(sql).toContain("INTERVAL '5 minutes'");
      expect(sensorId).toBe('caudal-deposito');
      expect(pulsesPerLitre).toBe(450);
    });

    it('uses hourly buckets for 7d and daily buckets for 30d', async () => {
      mockQueryRaw.mockResolvedValue([]);

      await request(app).get('/api/flow/caudal-deposito/history?range=7d');
      expect(mockQueryRaw.mock.calls[0][0]).toContain("INTERVAL '1 hour'");

      await request(app).get('/api/flow/caudal-deposito/history?range=30d');
      expect(mockQueryRaw.mock.calls[1][0]).toContain("INTERVAL '1 day'");
    });

    it('returns 500 when the query fails', async () => {
      mockQueryRaw.mockRejectedValue(new Error('db down'));

      const res = await request(app).get('/api/flow/caudal-deposito/history?range=24h');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/flow/:sensorId/daily', () => {
    it('returns 404 for an unknown sensor', async () => {
      const res = await request(app).get('/api/flow/no-such-sensor/daily');

      expect(res.status).toBe(404);
    });

    it('defaults to 30 days', async () => {
      mockQueryRaw.mockResolvedValue([]);

      const res = await request(app).get('/api/flow/caudal-deposito/daily');

      expect(res.status).toBe(200);
      expect(mockQueryRaw.mock.calls[0][2]).toBe(30);
      expect(mockQueryRaw.mock.calls[0][3]).toBe(450);
    });

    it('clamps the requested day count', async () => {
      mockQueryRaw.mockResolvedValue([]);

      await request(app).get('/api/flow/caudal-deposito/daily?days=9999');
      expect(mockQueryRaw.mock.calls[0][2]).toBe(365);

      await request(app).get('/api/flow/caudal-deposito/daily?days=0');
      expect(mockQueryRaw.mock.calls[1][2]).toBe(1);

      await request(app).get('/api/flow/caudal-deposito/daily?days=abc');
      expect(mockQueryRaw.mock.calls[2][2]).toBe(30);
    });
  });
});
