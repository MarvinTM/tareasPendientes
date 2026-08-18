import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const authenticatedUser = { id: 'usr-1', email: 'test@test.com', name: 'Test User', isApproved: true };

const mockPlan = {
  findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
  update: jest.fn(), delete: jest.fn(),
};
const mockActivation = {
  findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), delete: jest.fn(),
};

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: {
    deviceActivationPlan: mockPlan,
    deviceActivation: mockActivation,
  },
}));

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = authenticatedUser;
  next();
});

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
}));

jest.unstable_mockModule('../../services/shelly.js', () => ({
  getDeviceById: jest.fn().mockReturnValue({ id: 'dev-1', controlMode: 'toggle' }),
  turnDeviceOn: jest.fn(),
  turnDeviceOff: jest.fn(),
  loadConfig: jest.fn().mockReturnValue({ devices: [], groups: [] }),
  getDevices: jest.fn().mockReturnValue([]),
  getGroups: jest.fn().mockReturnValue([]),
  fetchDeviceStatus: jest.fn().mockResolvedValue({ on: null, online: false }),
  fetchAllStatuses: jest.fn().mockResolvedValue([]),
  toggleDevice: jest.fn(),
}));

jest.unstable_mockModule('../../services/activityLog.js', () => ({
  logActivity: jest.fn().mockResolvedValue(),
  ACTIONS: { DEVICE_TURNED_ON: 'DEVICE_TURNED_ON', DEVICE_TURNED_OFF: 'DEVICE_TURNED_OFF' },
}));

jest.unstable_mockModule('../../socket.js', () => ({
  emitDeviceUpdate: jest.fn(),
  setIO: jest.fn(),
}));

const MOCK_SUNRISE = new Date();
const MOCK_SUNSET = new Date();
MOCK_SUNRISE.setHours(7, 15, 0, 0);
MOCK_SUNSET.setHours(21, 30, 0, 0);

jest.unstable_mockModule('suncalc', () => ({
  getTimes: jest.fn(() => ({
    sunrise: MOCK_SUNRISE,
    sunset: MOCK_SUNSET,
  })),
}));

describe('Device Activation Routes', () => {
  let app;

  beforeEach(async () => {
    jest.clearAllMocks();
    const { default: deviceActivationRoutes } = await import('../../routes/deviceActivation.js');
    app = express();
    app.use(express.json());
    app.use('/api/devices', deviceActivationRoutes);
  });

  describe('GET /activation-plans', () => {
    it('returns list of plans with createdBy', async () => {
      mockPlan.findMany.mockResolvedValueOnce([
        { id: 'p-1', name: 'Morning', activationTime: '08:00', deactivationTime: '12:00' },
      ]);

      const res = await request(app).get('/api/devices/activation-plans');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Morning');
    });

    it('returns 500 on database error', async () => {
      mockPlan.findMany.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/devices/activation-plans');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /activation-plans', () => {
    it('creates a plan with fixed modes', async () => {
      mockPlan.create.mockResolvedValueOnce({
        id: 'p-new', name: 'Pool Pump', activationTime: '10:00', deactivationTime: '18:00', activationMode: 'fixed', deactivationMode: 'fixed', timezone: 'Europe/Madrid',
      });

      const res = await request(app)
        .post('/api/devices/activation-plans')
        .send({ name: 'Pool Pump', activationTime: '10:00', deactivationTime: '18:00' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Pool Pump');
      expect(mockPlan.create).toHaveBeenCalledWith({
        data: {
          name: 'Pool Pump',
          activationTime: '10:00',
          deactivationTime: '18:00',
          activationMode: 'fixed',
          deactivationMode: 'fixed',
          timezone: 'Europe/Madrid',
          createdById: 'usr-1',
        },
        include: expect.any(Object),
      });
    });

    it('creates a plan with sunrise/sunset modes — stores 00:00 placeholders', async () => {
      mockPlan.create.mockResolvedValueOnce({
        id: 'p-new', name: 'Sun', activationTime: '00:00', deactivationTime: '00:00', activationMode: 'sunrise', deactivationMode: 'sunset', timezone: 'Europe/Madrid',
      });

      const res = await request(app)
        .post('/api/devices/activation-plans')
        .send({ name: 'Sun', activationMode: 'sunrise', deactivationMode: 'sunset' });

      expect(res.status).toBe(201);
      expect(mockPlan.create).toHaveBeenCalledWith({
        data: {
          name: 'Sun',
          activationTime: '00:00',
          deactivationTime: '00:00',
          activationMode: 'sunrise',
          deactivationMode: 'sunset',
          timezone: 'Europe/Madrid',
          createdById: 'usr-1',
        },
        include: expect.any(Object),
      });
    });

    it('returns 400 for invalid activationMode', async () => {
      const res = await request(app)
        .post('/api/devices/activation-plans')
        .send({ name: 'Bad', activationTime: '10:00', deactivationTime: '18:00', activationMode: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/devices/activation-plans')
        .send({ activationTime: '10:00', deactivationTime: '18:00' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when activation >= deactivation for fixed modes', async () => {
      const res = await request(app)
        .post('/api/devices/activation-plans')
        .send({ name: 'Bad', activationTime: '18:00', deactivationTime: '10:00' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when activationTime missing for fixed mode', async () => {
      const res = await request(app)
        .post('/api/devices/activation-plans')
        .send({ name: 'Test', deactivationTime: '18:00' });

      expect(res.status).toBe(400);
    });

    it('trims name', async () => {
      mockPlan.create.mockResolvedValueOnce({ id: 'p-1' });

      await request(app)
        .post('/api/devices/activation-plans')
        .send({ name: '  Test  ', activationTime: '08:00', deactivationTime: '12:00' });

      expect(mockPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Test' }) })
      );
    });
  });

  describe('PATCH /activation-plans/:id', () => {
    it('updates a plan', async () => {
      mockPlan.findUnique.mockResolvedValueOnce({ id: 'p-1', activationMode: 'fixed', deactivationMode: 'fixed' });
      mockPlan.update.mockResolvedValueOnce({
        id: 'p-1', name: 'Updated', activationTime: '09:00', deactivationTime: '17:00',
      });

      const res = await request(app)
        .patch('/api/devices/activation-plans/p-1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated');
    });

    it('returns 404 when plan not found', async () => {
      mockPlan.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/devices/activation-plans/non-existent')
        .send({ name: 'Test' });

      expect(res.status).toBe(404);
    });

    it('validates activation < deactivation on update for fixed modes', async () => {
      mockPlan.findUnique.mockResolvedValueOnce({
        id: 'p-1', activationTime: '08:00', deactivationTime: '12:00', activationMode: 'fixed', deactivationMode: 'fixed',
      });

      const res = await request(app)
        .patch('/api/devices/activation-plans/p-1')
        .send({ activationTime: '20:00' });

      expect(res.status).toBe(400);
    });

    it('validates activation < deactivation when both updated', async () => {
      mockPlan.findUnique.mockResolvedValueOnce({ id: 'p-1', activationMode: 'fixed', deactivationMode: 'fixed' });

      const res = await request(app)
        .patch('/api/devices/activation-plans/p-1')
        .send({ activationTime: '18:00', deactivationTime: '17:00' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /activation-plans/:id', () => {
    it('deletes a plan', async () => {
      mockPlan.findUnique.mockResolvedValueOnce({ id: 'p-1' });
      mockPlan.delete.mockResolvedValueOnce({});

      const res = await request(app).delete('/api/devices/activation-plans/p-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when plan not found', async () => {
      mockPlan.findUnique.mockResolvedValueOnce(null);

      const res = await request(app).delete('/api/devices/activation-plans/non-existent');

      expect(res.status).toBe(404);
    });

    it('rejects activation plans for pulse devices', async () => {
      const { getDeviceById } = await import('../../services/shelly.js');
      getDeviceById.mockReturnValueOnce({ id: 'garage', controlMode: 'pulse' });

      const res = await request(app)
        .post('/api/devices/garage/activation')
        .send({ planId: 'p-1' });

      expect(res.status).toBe(400);
      expect(mockPlan.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('GET /activation-status', () => {
    it('returns status map of device assignments', async () => {
      mockActivation.findMany.mockResolvedValueOnce([
        { deviceId: 'dev-1', planId: 'p-1', plan: { id: 'p-1', name: 'Morning', activationTime: '08:00', deactivationTime: '12:00', activationMode: 'fixed', deactivationMode: 'fixed' } },
        { deviceId: 'dev-2', planId: 'p-1', plan: { id: 'p-1', name: 'Morning', activationTime: '08:00', deactivationTime: '12:00', activationMode: 'fixed', deactivationMode: 'fixed' } },
      ]);

      const res = await request(app).get('/api/devices/activation-status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        'dev-1': { planId: 'p-1', planName: 'Morning', activationTime: '08:00', deactivationTime: '12:00', activationMode: 'fixed', deactivationMode: 'fixed' },
        'dev-2': { planId: 'p-1', planName: 'Morning', activationTime: '08:00', deactivationTime: '12:00', activationMode: 'fixed', deactivationMode: 'fixed' },
      });
    });

    it('returns empty object when no assignments', async () => {
      mockActivation.findMany.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/devices/activation-status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });
  });

  describe('POST /:deviceId/activation', () => {
    it('assigns a plan to a device', async () => {
      mockPlan.findUnique.mockResolvedValueOnce({ id: 'p-1' });
      mockActivation.upsert.mockResolvedValueOnce({
        deviceId: 'dev-1', planId: 'p-1',
        plan: { id: 'p-1', name: 'Morning' },
      });

      const res = await request(app)
        .post('/api/devices/dev-1/activation')
        .send({ planId: 'p-1' });

      expect(res.status).toBe(200);
      expect(res.body.deviceId).toBe('dev-1');
      expect(mockActivation.upsert).toHaveBeenCalledWith({
        where: { deviceId: 'dev-1' },
        update: { planId: 'p-1' },
        create: { deviceId: 'dev-1', planId: 'p-1' },
        include: expect.any(Object),
      });
    });

    it('returns 400 when planId missing', async () => {
      const res = await request(app)
        .post('/api/devices/dev-1/activation')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 when plan not found', async () => {
      mockPlan.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/devices/dev-1/activation')
        .send({ planId: 'p-999' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:deviceId/activation', () => {
    it('removes a plan from a device', async () => {
      mockActivation.findUnique.mockResolvedValueOnce({ deviceId: 'dev-1' });
      mockActivation.delete.mockResolvedValueOnce({});

      const res = await request(app).delete('/api/devices/dev-1/activation');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when no activation assigned', async () => {
      mockActivation.findUnique.mockResolvedValueOnce(null);

      const res = await request(app).delete('/api/devices/dev-1/activation');

      expect(res.status).toBe(404);
    });
  });
});
