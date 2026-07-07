import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const authenticatedUser = { id: 'usr-1', email: 'test@test.com', name: 'Test User', isApproved: true };

const mockGetState = jest.fn();
const mockEnqueue = jest.fn();
const mockDequeue = jest.fn();
const mockStopCurrent = jest.fn();

const mockPrisma = {
  riegoPlan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: mockPrisma,
}));

jest.unstable_mockModule('../../services/riegoQueue.js', () => ({
  getState: mockGetState,
  enqueue: mockEnqueue,
  dequeue: mockDequeue,
  stopCurrent: mockStopCurrent,
}));

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = authenticatedUser;
  next();
});

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
}));

describe('Riego Routes', () => {
  let app;

  beforeEach(async () => {
    jest.clearAllMocks();
    const { default: riegoRoutes } = await import('../../routes/riego.js');
    app = express();
    app.use(express.json());
    app.use('/api/riego', riegoRoutes);
  });

  describe('GET /api/riego/status', () => {
    it('returns state with phases', async () => {
      mockGetState.mockReturnValueOnce({
        current: null,
        queue: [],
        phases: [{ id: 'fase-1', name: 'Jardín' }],
        durationMemory: {},
      });

      const res = await request(app).get('/api/riego/status');

      expect(res.status).toBe(200);
      expect(res.body.phases).toHaveLength(1);
    });

    it('returns 401 when not authenticated', async () => {
      mockAuthenticateToken.mockImplementationOnce((req, res) => {
        return res.status(401).json({ error: 'Unauthorized' });
      });
      const res = await request(app).get('/api/riego/status');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/riego/start', () => {
    it('starts phase and returns state', async () => {
      mockEnqueue.mockReturnValueOnce('queue-id-1');
      mockGetState.mockReturnValueOnce({ current: {}, queue: [], phases: [], durationMemory: {} });

      const res = await request(app)
        .post('/api/riego/start')
        .send({ phaseId: 'fase-1', durationMin: 10 });

      expect(res.status).toBe(201);
      expect(res.body.queueId).toBe('queue-id-1');
      expect(mockEnqueue).toHaveBeenCalledWith('fase-1', 10);
    });

    it('returns 400 when phaseId missing', async () => {
      const res = await request(app)
        .post('/api/riego/start')
        .send({ durationMin: 10 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when durationMin missing', async () => {
      const res = await request(app)
        .post('/api/riego/start')
        .send({ phaseId: 'fase-1' });

      expect(res.status).toBe(400);
    });

    it('returns 400 on validation error', async () => {
      mockEnqueue.mockImplementationOnce(() => {
        throw new Error('Duración inválida. Debe ser entre 1 y 120 minutos.');
      });

      const res = await request(app)
        .post('/api/riego/start')
        .send({ phaseId: 'fase-1', durationMin: 121 });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/riego/stop', () => {
    it('stops current and returns state', async () => {
      mockGetState
        .mockReturnValueOnce({ current: { phaseId: 'fase-1', name: 'Fase 1' }, queue: [], phases: [], durationMemory: {} })
        .mockReturnValueOnce({ current: null, queue: [], phases: [], durationMemory: {} });

      const res = await request(app).post('/api/riego/stop');

      expect(res.status).toBe(200);
      expect(res.body.current).toBeNull();
      expect(mockStopCurrent).toHaveBeenCalled();
    });

    it('returns 200 even when nothing active', async () => {
      mockGetState
        .mockReturnValueOnce({ current: null, queue: [], phases: [], durationMemory: {} })
        .mockReturnValueOnce({ current: null, queue: [], phases: [], durationMemory: {} });

      const res = await request(app).post('/api/riego/stop');

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/riego/queue/:queueId', () => {
    it('removes item and returns state', async () => {
      mockDequeue.mockReturnValueOnce(true);
      mockGetState.mockReturnValueOnce({ current: null, queue: [], phases: [], durationMemory: {} });

      const res = await request(app).delete('/api/riego/queue/q-1');

      expect(res.status).toBe(200);
      expect(mockDequeue).toHaveBeenCalledWith('q-1');
    });

    it('returns 404 for invalid queueId', async () => {
      mockDequeue.mockReturnValueOnce(false);

      const res = await request(app).delete('/api/riego/queue/invalid');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/riego/plans', () => {
    it('returns plan list', async () => {
      mockPrisma.riegoPlan.findMany.mockResolvedValueOnce([
        { id: 'p-1', name: 'Plan 1', phases: [], createdAt: new Date() },
      ]);

      const res = await request(app).get('/api/riego/plans');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /api/riego/plans', () => {
    it('creates plan', async () => {
      mockPrisma.riegoPlan.create.mockResolvedValueOnce({
        id: 'p-1', name: 'Plan 1', phases: [{ phaseId: 'fase-1', durationMin: 10 }],
      });

      const res = await request(app)
        .post('/api/riego/plans')
        .send({ name: 'Plan 1', phases: [{ phaseId: 'fase-1', durationMin: 10 }] });

      expect(res.status).toBe(201);
    });

    it('returns 400 without name', async () => {
      const res = await request(app)
        .post('/api/riego/plans')
        .send({ phases: [{ phaseId: 'fase-1', durationMin: 10 }] });

      expect(res.status).toBe(400);
    });

    it('returns 400 with empty phases', async () => {
      const res = await request(app)
        .post('/api/riego/plans')
        .send({ name: 'Plan', phases: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/riego/plans/:id', () => {
    it('updates plan', async () => {
      mockPrisma.riegoPlan.findUnique.mockResolvedValueOnce({ id: 'p-1' });
      mockPrisma.riegoPlan.update.mockResolvedValueOnce({ id: 'p-1', name: 'Updated' });

      const res = await request(app)
        .patch('/api/riego/plans/p-1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
    });

    it('returns 404 for non-existent', async () => {
      mockPrisma.riegoPlan.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/riego/plans/p-1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/riego/plans/:id', () => {
    it('deletes plan', async () => {
      mockPrisma.riegoPlan.findUnique.mockResolvedValueOnce({ id: 'p-1' });
      mockPrisma.riegoPlan.delete.mockResolvedValueOnce({});

      const res = await request(app).delete('/api/riego/plans/p-1');

      expect(res.status).toBe(200);
    });

    it('returns 404 for non-existent', async () => {
      mockPrisma.riegoPlan.findUnique.mockResolvedValueOnce(null);

      const res = await request(app).delete('/api/riego/plans/p-1');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/riego/plans/:id/trigger', () => {
    it('enqueues all plan phases', async () => {
      mockPrisma.riegoPlan.findUnique.mockResolvedValueOnce({
        id: 'p-1', name: 'Plan', phases: [
          { phaseId: 'fase-1', durationMin: 10 },
          { phaseId: 'fase-2', durationMin: 5 },
        ],
      });
      mockGetState.mockReturnValueOnce({ current: null, queue: [], phases: [], durationMemory: {} });

      const res = await request(app).post('/api/riego/plans/p-1/trigger');

      expect(res.status).toBe(201);
      expect(mockEnqueue).toHaveBeenCalledTimes(2);
    });

    it('returns 404 for non-existent plan', async () => {
      mockPrisma.riegoPlan.findUnique.mockResolvedValueOnce(null);

      const res = await request(app).post('/api/riego/plans/invalid/trigger');

      expect(res.status).toBe(404);
    });
  });
});
