import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const authenticatedUser = { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true };

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = authenticatedUser;
  next();
});
const mockRequireAdmin = jest.fn((req, res, next) => next());

const mockPrisma = {
  category: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
};

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: mockPrisma
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
  generateToken: jest.fn()
}));

jest.unstable_mockModule('../../middleware/admin.js', () => ({
  requireAdmin: mockRequireAdmin
}));

const router = (await import('../../routes/categories.js')).default;
const app = express();
app.use(express.json());
app.use(router);

describe('Categories Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req, res, next) => {
      req.user = authenticatedUser;
      next();
    });
    mockRequireAdmin.mockImplementation((req, res, next) => next());
  });

  describe('GET /', () => {
    it('should return list of categories with task count', async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Work', emoji: '💼', createdAt: new Date(), _count: { tasks: 3 } },
        { id: 'cat-2', name: 'Home', emoji: '🏠', createdAt: new Date(), _count: { tasks: 0 } }
      ]);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Work');
      expect(res.body[0]._count.tasks).toBe(3);
    });

    it('should return empty list when no categories', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return 500 on database error', async () => {
      mockPrisma.category.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /', () => {
    it('should return 400 when name is missing', async () => {
      const res = await request(app).post('/').send({ emoji: '💼' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name is required');
    });

    it('should return 400 when emoji is missing', async () => {
      const res = await request(app).post('/').send({ name: 'Work' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Emoji is required');
    });

    it('should create category successfully', async () => {
      const created = { id: 'cat-1', name: 'Work', emoji: '💼', createdAt: new Date(), _count: { tasks: 0 } };
      mockPrisma.category.create.mockResolvedValue(created);

      const res = await request(app).post('/').send({ name: 'Work', emoji: '💼' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Work');
    });

    it('should trim name and emoji', async () => {
      mockPrisma.category.create.mockResolvedValue({ id: 'cat-1', name: 'Work', emoji: '💼' });

      const res = await request(app).post('/').send({ name: '  Work  ', emoji: '  💼  ' });

      expect(res.status).toBe(201);
      expect(mockPrisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Work', emoji: '💼' }) })
      );
    });

    it('should return 400 on duplicate name', async () => {
      const duplicateError = new Error('Unique constraint');
      duplicateError.code = 'P2002';
      mockPrisma.category.create.mockRejectedValue(duplicateError);

      const res = await request(app).post('/').send({ name: 'Duplicate', emoji: '🏠' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('A category with this name already exists');
    });

    it('should return 403 when user is not admin', async () => {
      mockRequireAdmin.mockImplementationOnce((req, res) => {
        res.status(403).json({ error: 'Admin access required' });
      });

      const res = await request(app).post('/').send({ name: 'Work', emoji: '💼' });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /:id', () => {
    it('should return 404 when category not found', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app).patch('/bad-id').send({ name: 'New' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Category not found');
    });

    it('should return 400 when name is empty', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Old' });

      const res = await request(app).patch('/cat-1').send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name cannot be empty');
    });

    it('should return 400 when emoji is empty', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Cat' });

      const res = await request(app).patch('/cat-1').send({ emoji: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Emoji cannot be empty');
    });

    it('should update category successfully', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Old' });
      mockPrisma.category.update.mockResolvedValue({ id: 'cat-1', name: 'New Name', emoji: '🆕' });

      const res = await request(app).patch('/cat-1').send({ name: 'New Name', emoji: '🆕' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
    });

    it('should handle duplicate name error on update', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Old' });
      const duplicateError = new Error('Unique constraint');
      duplicateError.code = 'P2002';
      mockPrisma.category.update.mockRejectedValue(duplicateError);

      const res = await request(app).patch('/cat-1').send({ name: 'Taken' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('A category with this name already exists');
    });
  });

  describe('DELETE /:id', () => {
    it('should return 404 when category not found', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app).delete('/bad-id');

      expect(res.status).toBe(404);
    });

    it('should return 400 when category has tasks', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-1', _count: { tasks: 5 }
      });

      const res = await request(app).delete('/cat-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot delete category');
      expect(res.body.error).toContain('5 task');
    });

    it('should delete category successfully', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-1', _count: { tasks: 0 }
      });

      const res = await request(app).delete('/cat-1');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Category deleted successfully');
      expect(mockPrisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
    });
  });
});
