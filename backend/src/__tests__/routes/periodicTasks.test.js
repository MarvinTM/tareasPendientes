import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const authenticatedUser = { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true };

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = authenticatedUser;
  next();
});

const mockPrisma = {
  periodicTask: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  task: {
    findMany: jest.fn(),
    deleteMany: jest.fn()
  },
  category: {
    findUnique: jest.fn()
  },
  $transaction: jest.fn()
};

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: mockPrisma
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
  generateToken: jest.fn()
}));

const router = (await import('../../routes/periodicTasks.js')).default;
const app = express();
app.use(express.json());
app.use(router);

describe('PeriodicTasks Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req, res, next) => {
      req.user = authenticatedUser;
      next();
    });
  });

  describe('GET /', () => {
    it('should return all periodic tasks', async () => {
      mockPrisma.periodicTask.findMany.mockResolvedValue([
        { id: 'pt-1', title: 'Weekly Clean', frequency: 'WEEKLY', dayOfWeek: 1, category: { id: 'cat-1', name: 'Home', emoji: '🏠' }, assignedTo: null }
      ]);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Weekly Clean');
    });

    it('should return empty list', async () => {
      mockPrisma.periodicTask.findMany.mockResolvedValue([]);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('POST /', () => {
    const validRequestBody = {
      title: 'Weekly Clean',
      size: 'Pequena',
      frequency: 'WEEKLY',
      dayOfWeek: 1,
      categoryId: 'cat-1'
    };

    it('should return 400 when title is missing', async () => {
      const res = await request(app).post('/').send({ ...validRequestBody, title: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Title is required');
    });

    it('should return 400 when frequency is invalid', async () => {
      const res = await request(app).post('/').send({ ...validRequestBody, frequency: 'DAILY' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Valid frequency is required');
    });

    it('should return 400 when dayOfWeek is missing for weekly task', async () => {
      const res = await request(app).post('/').send({ title: 'T', frequency: 'WEEKLY', categoryId: 'cat-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Valid day of week');
    });

    it('should return 400 when dayOfWeek is out of range', async () => {
      const res = await request(app).post('/').send({ ...validRequestBody, dayOfWeek: 7 });

      expect(res.status).toBe(400);
    });

    it('should return 400 when monthOfYear is missing for monthly task', async () => {
      const res = await request(app).post('/').send({ title: 'T', frequency: 'MONTHLY', categoryId: 'cat-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Valid month');
    });

    it('should return 400 when monthOfYear is out of range', async () => {
      const res = await request(app).post('/').send({ title: 'T', frequency: 'MONTHLY', monthOfYear: 12, categoryId: 'cat-1' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when activeFromMonth is out of range', async () => {
      const res = await request(app).post('/').send({ ...validRequestBody, activeFromMonth: 12 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Valid activeFromMonth');
    });

    it('should return 400 when activeToMonth is out of range', async () => {
      const res = await request(app).post('/').send({ ...validRequestBody, activeToMonth: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Valid activeToMonth');
    });

    it('should return 400 when category does not exist', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/').send(validRequestBody);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid category');
    });

    it('should create a weekly periodic task', async () => {
      const category = { id: 'cat-1', name: 'Home', emoji: '🏠' };
      const created = {
        id: 'pt-1', title: 'Weekly Clean', frequency: 'WEEKLY', dayOfWeek: 1,
        category, assignedTo: null
      };

      mockPrisma.category.findUnique.mockResolvedValue(category);
      mockPrisma.periodicTask.create.mockResolvedValue(created);

      const res = await request(app).post('/').send(validRequestBody);

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Weekly Clean');

      const createCall = mockPrisma.periodicTask.create.mock.calls[0][0];
      expect(createCall.data.frequency).toBe('WEEKLY');
      expect(createCall.data.dayOfWeek).toBe(1);
      expect(createCall.data.monthOfYear).toBeNull();
    });

    it('should create a monthly periodic task', async () => {
      const category = { id: 'cat-1', name: 'Reports', emoji: '📊' };
      const created = {
        id: 'pt-2', title: 'Monthly Report', frequency: 'MONTHLY', monthOfYear: 5,
        category, assignedTo: null
      };

      mockPrisma.category.findUnique.mockResolvedValue(category);
      mockPrisma.periodicTask.create.mockResolvedValue(created);

      const res = await request(app).post('/').send({
        title: 'Monthly Report', frequency: 'MONTHLY', monthOfYear: 5, categoryId: 'cat-1'
      });

      expect(res.status).toBe(201);
      const createCall = mockPrisma.periodicTask.create.mock.calls[0][0];
      expect(createCall.data.frequency).toBe('MONTHLY');
      expect(createCall.data.monthOfYear).toBe(5);
      expect(createCall.data.dayOfWeek).toBeNull();
    });

    it('should allow active month range for weekly tasks only', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.periodicTask.create.mockResolvedValue({ id: 'pt-1' });

      const res = await request(app).post('/').send({
        ...validRequestBody, activeFromMonth: 3, activeToMonth: 9
      });

      expect(res.status).toBe(201);
    });

    it('should return 500 on create error', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.periodicTask.create.mockRejectedValue(new Error('DB error'));

      const res = await request(app).post('/').send(validRequestBody);

      expect(res.status).toBe(500);
    });
  });

  describe('PATCH /:id', () => {
    it('should update a periodic task', async () => {
      const updated = { id: 'pt-1', title: 'Updated Title', frequency: 'WEEKLY', category: {}, assignedTo: null };
      mockPrisma.periodicTask.update.mockResolvedValue(updated);

      const res = await request(app).patch('/pt-1').send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
    });

    it('should return 500 on update error', async () => {
      mockPrisma.periodicTask.update.mockRejectedValue(new Error('DB error'));

      const res = await request(app).patch('/pt-1').send({ title: 'New' });

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /:id', () => {
    it('should delete without removing pending tasks by default', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          task: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn()
          },
          periodicTask: {
            delete: jest.fn()
          }
        };
        return callback(tx);
      });

      const res = await request(app).delete('/pt-1');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Periodic task deleted');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should delete pending tasks when deletePending=true', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          task: {
            findMany: jest.fn().mockResolvedValue([{ id: 't1' }, { id: 't2' }]),
            deleteMany: jest.fn()
          },
          periodicTask: {
            delete: jest.fn()
          }
        };
        return callback(tx);
      });

      const res = await request(app).delete('/pt-1?deletePending=true');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Periodic task deleted');
    });

    it('should return 500 on delete error', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

      const res = await request(app).delete('/pt-1');

      expect(res.status).toBe(500);
    });
  });
});
