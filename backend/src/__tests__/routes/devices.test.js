import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const authenticatedUser = { id: 'usr-1', email: 'test@test.com', name: 'Test User', isApproved: true };

const mockFetchAllStatuses = jest.fn();
const mockToggleDevice = jest.fn();
const mockGetDeviceById = jest.fn();
const mockEmitDeviceUpdate = jest.fn();

jest.unstable_mockModule('../../services/shelly.js', () => ({
  fetchAllStatuses: mockFetchAllStatuses,
  toggleDevice: mockToggleDevice,
  getDeviceById: mockGetDeviceById,
}));

jest.unstable_mockModule('../../socket.js', () => ({
  emitDeviceUpdate: mockEmitDeviceUpdate,
}));

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = authenticatedUser;
  next();
});

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
}));

describe('Devices Routes', () => {
  let app;

  beforeEach(async () => {
    jest.clearAllMocks();
    const { default: deviceRoutes } = await import('../../routes/devices.js');
    app = express();
    app.use(express.json());
    app.use('/api/devices', deviceRoutes);
  });

  describe('GET /api/devices', () => {
    it('returns device list with statuses', async () => {
      mockFetchAllStatuses.mockResolvedValueOnce([
        { id: 'dev-1', name: 'Luz del salón', room: 'Salón', on: true, online: true },
        { id: 'dev-2', name: 'Luz de la cocina', room: 'Cocina', on: false, online: true },
      ]);

      const res = await request(app).get('/api/devices');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual({ id: 'dev-1', name: 'Luz del salón', room: 'Salón', on: true, online: true });
    });

    it('returns offline devices with on: null', async () => {
      mockFetchAllStatuses.mockResolvedValueOnce([
        { id: 'dev-1', name: 'Luz del baño', room: 'Baño', on: null, online: false },
      ]);

      const res = await request(app).get('/api/devices');

      expect(res.status).toBe(200);
      expect(res.body[0].online).toBe(false);
      expect(res.body[0].on).toBeNull();
    });

    it('returns 401 when not authenticated', async () => {
      mockAuthenticateToken.mockImplementationOnce((req, res) => {
        return res.status(401).json({ error: 'Unauthorized' });
      });

      const res = await request(app).get('/api/devices');

      expect(res.status).toBe(401);
    });

    it('returns 500 on service error', async () => {
      mockFetchAllStatuses.mockRejectedValueOnce(new Error('Service failure'));

      const res = await request(app).get('/api/devices');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch devices');
    });
  });

  describe('POST /api/devices/:deviceId/toggle', () => {
    it('toggles device and returns new state', async () => {
      mockGetDeviceById.mockReturnValueOnce({ id: 'dev-1', name: 'Luz del salón', room: 'Salón' });
      mockToggleDevice.mockResolvedValueOnce({ on: false });

      const res = await request(app).post('/api/devices/dev-1/toggle');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 'dev-1', on: false });
      expect(mockToggleDevice).toHaveBeenCalledWith('dev-1');
    });

    it('returns 404 when device not in config', async () => {
      mockGetDeviceById.mockReturnValueOnce(null);

      const res = await request(app).post('/api/devices/unknown/toggle');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Device not found');
      expect(mockToggleDevice).not.toHaveBeenCalled();
    });

    it('emits device:updated socket event', async () => {
      mockGetDeviceById.mockReturnValueOnce({ id: 'dev-1', name: 'Luz del salón', room: 'Salón' });
      mockToggleDevice.mockResolvedValueOnce({ on: true });

      await request(app).post('/api/devices/dev-1/toggle');

      expect(mockEmitDeviceUpdate).toHaveBeenCalledWith({
        id: 'dev-1',
        name: 'Luz del salón',
        room: 'Salón',
        on: true,
      });
    });

    it('returns 502 when Shelly is unreachable', async () => {
      mockGetDeviceById.mockReturnValueOnce({ id: 'dev-1', name: 'Luz del salón', room: 'Salón' });
      mockToggleDevice.mockRejectedValueOnce(new Error('Shelly API error: HTTP 502'));

      const res = await request(app).post('/api/devices/dev-1/toggle');

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('Shelly device unreachable');
    });

    it('returns 401 when not authenticated', async () => {
      mockAuthenticateToken.mockImplementationOnce((req, res) => {
        return res.status(401).json({ error: 'Unauthorized' });
      });

      const res = await request(app).post('/api/devices/dev-1/toggle');

      expect(res.status).toBe(401);
    });

    it('returns 500 on unexpected errors', async () => {
      mockGetDeviceById.mockReturnValueOnce({ id: 'dev-1', name: 'Luz del salón', room: 'Salón' });
      mockToggleDevice.mockRejectedValueOnce(new Error('Unexpected error'));

      const res = await request(app).post('/api/devices/dev-1/toggle');

      expect(res.status).toBe(500);
    });
  });
});
