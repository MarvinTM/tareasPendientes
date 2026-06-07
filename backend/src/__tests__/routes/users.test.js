import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const authenticatedUser = { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true };

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = authenticatedUser;
  next();
});

const mockPrisma = {
  user: {
    findMany: jest.fn()
  },
  taskHistory: {
    findMany: jest.fn()
  }
};

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: mockPrisma
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
  generateToken: jest.fn()
}));

const router = (await import('../../routes/users.js')).default;
const app = express();
app.use(express.json());
app.use(router);

describe('Users Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req, res, next) => {
      req.user = authenticatedUser;
      next();
    });
  });

  describe('GET /', () => {
    it('should return approved users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'usr-1', name: 'User One', shortName: 'U1', color: '#000', email: 'one@test.com', picture: null },
        { id: 'usr-2', name: 'User Two', shortName: 'U2', color: '#fff', email: 'two@test.com', picture: null }
      ]);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isApproved: true } })
      );
    });

    it('should return empty list when no approved users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /scores', () => {
    it('should return user scores for all time', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'usr-1', name: 'User One', shortName: 'U1', color: '#000', picture: null },
        { id: 'usr-2', name: 'User Two', shortName: 'U2', color: '#fff', picture: null }
      ]);

      const res = await request(app).get('/scores');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].taskCount).toBe(0);
      expect(res.body[0].totalPoints).toBe(0);
    });

    it('should return scores with period filter (week)', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await request(app).get('/scores?period=week');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
      expect(mockPrisma.taskHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ action: 'STATUS_CHANGED', newValue: 'Completada' }) })
      );
    });

    it('should return scores with period filter (month)', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await request(app).get('/scores?period=month');

      expect(res.status).toBe(200);
    });

    it('should return scores with period filter (year)', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await request(app).get('/scores?period=year');

      expect(res.status).toBe(200);
    });

    it('should calculate scores for completed tasks', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([
        {
          taskId: 't1',
          task: { id: 't1', size: 'Pequena', status: 'Completada', assignedToId: 'usr-1' }
        },
        {
          taskId: 't2',
          task: { id: 't2', size: 'Grande', status: 'Completada', assignedToId: 'usr-1' }
        },
        {
          taskId: 't3',
          task: { id: 't3', size: 'Mediana', status: 'Completada', assignedToId: 'usr-2' }
        }
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'usr-1', name: 'User One', shortName: 'U1', color: '#000', picture: null },
        { id: 'usr-2', name: 'User Two', shortName: 'U2', color: '#fff', picture: null }
      ]);

      const res = await request(app).get('/scores');

      expect(res.status).toBe(200);
      const user1 = res.body.find(u => u.id === 'usr-1');
      const user2 = res.body.find(u => u.id === 'usr-2');
      expect(user1.taskCount).toBe(2);
      expect(user1.totalPoints).toBe(4);
      expect(user2.taskCount).toBe(1);
      expect(user2.totalPoints).toBe(2);
    });

    it('should sort scores by total points descending', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([
        { taskId: 't1', task: { id: 't1', size: 'Grande', status: 'Completada', assignedToId: 'usr-1' } },
        { taskId: 't2', task: { id: 't2', size: 'Grande', status: 'Completada', assignedToId: 'usr-2' } },
        { taskId: 't3', task: { id: 't3', size: 'Grande', status: 'Completada', assignedToId: 'usr-2' } },
        { taskId: 't4', task: { id: 't4', size: 'Grande', status: 'Completada', assignedToId: 'usr-2' } }
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'usr-1', name: 'User One', shortName: null, color: null, picture: null },
        { id: 'usr-2', name: 'User Two', shortName: null, color: null, picture: null }
      ]);

      const res = await request(app).get('/scores');

      expect(res.body[0].id).toBe('usr-2');
      expect(res.body[0].totalPoints).toBe(9);
      expect(res.body[1].id).toBe('usr-1');
      expect(res.body[1].totalPoints).toBe(3);
    });

    it('should not count unassigned completed tasks', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([
        { taskId: 't1', task: { id: 't1', size: 'Grande', status: 'Completada', assignedToId: null } }
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'usr-1', name: 'User One', shortName: null, color: null, picture: null }
      ]);

      const res = await request(app).get('/scores');

      expect(res.body[0].taskCount).toBe(0);
      expect(res.body[0].totalPoints).toBe(0);
    });

    it('should handle unknown size with default 1 point', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([
        { taskId: 't1', task: { id: 't1', size: 'Gigante', status: 'Completada', assignedToId: 'usr-1' } }
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'usr-1', name: 'User One', shortName: null, color: null, picture: null }
      ]);

      const res = await request(app).get('/scores');

      expect(res.body[0].totalPoints).toBe(1);
    });
  });
});
