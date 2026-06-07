import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const authenticatedUser = { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true };

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = authenticatedUser;
  next();
});

const mockPrisma = {
  taskHistory: {
    findMany: jest.fn(),
    count: jest.fn()
  }
};

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: mockPrisma
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
  generateToken: jest.fn()
}));

const router = (await import('../../routes/history.js')).default;
const app = express();
app.use(express.json());
app.use(router);

describe('History Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req, res, next) => {
      req.user = authenticatedUser;
      next();
    });
  });

  describe('GET /', () => {
    it('should return history with default pagination', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([
        { id: 'h1', action: 'CREATED', timestamp: new Date(), task: { id: '1', title: 'T1' }, user: { id: 'usr-1', name: 'Test' } }
      ]);
      mockPrisma.taskHistory.count.mockResolvedValue(1);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.history).toHaveLength(1);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(50);
      expect(res.body.pagination.total).toBe(1);
      expect(res.body.pagination.totalPages).toBe(1);
    });

    it('should support custom page and limit', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([]);
      mockPrisma.taskHistory.count.mockResolvedValue(100);

      const res = await request(app).get('/?page=2&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.limit).toBe(10);
      expect(res.body.pagination.total).toBe(100);
      expect(res.body.pagination.totalPages).toBe(10);
      expect(mockPrisma.taskHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
    });

    it('should default to page 1 when page is invalid', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([]);
      mockPrisma.taskHistory.count.mockResolvedValue(0);

      const res = await request(app).get('/?page=invalid');

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
    });

    it('should return empty list when no history', async () => {
      mockPrisma.taskHistory.findMany.mockResolvedValue([]);
      mockPrisma.taskHistory.count.mockResolvedValue(0);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.history).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it('should return 500 on database error', async () => {
      mockPrisma.taskHistory.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/');

      expect(res.status).toBe(500);
    });
  });
});
