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
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
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

const router = (await import('../../routes/admin.js')).default;
const app = express();
app.use(express.json());
app.use(router);

describe('Admin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req, res, next) => {
      req.user = authenticatedUser;
      next();
    });
    mockRequireAdmin.mockImplementation((req, res, next) => next());
  });

  describe('GET /users', () => {
    it('should return users with admin flag', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'usr-1', email: 'admin@test.com', name: 'Admin', isApproved: true, createdAt: new Date() },
        { id: 'usr-2', email: 'user@test.com', name: 'User', isApproved: false, createdAt: new Date() }
      ]);

      const res = await request(app).get('/users');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].isAdmin).toBe(true);
      expect(res.body[1].isAdmin).toBe(false);
    });

    it('should return empty list when no users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await request(app).get('/users');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return 500 on database error', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/users');

      expect(res.status).toBe(500);
    });

    it('should return 403 when user is not admin', async () => {
      mockRequireAdmin.mockImplementationOnce((req, res) => {
        res.status(403).json({ error: 'Admin access required' });
      });

      const res = await request(app).get('/users');

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /users/:id', () => {
    it('should update user shortName and color', async () => {
      const updated = { id: 'usr-1', email: 'test@test.com', name: 'Test', shortName: 'T', color: '#fff', isApproved: true };
      mockPrisma.user.update.mockResolvedValue(updated);

      const res = await request(app).patch('/users/usr-1').send({ shortName: 'T', color: '#fff' });

      expect(res.status).toBe(200);
      expect(res.body.shortName).toBe('T');
      expect(res.body.color).toBe('#fff');
    });

    it('should return 500 on update error', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('DB error'));

      const res = await request(app).patch('/users/usr-1').send({ shortName: 'X' });

      expect(res.status).toBe(500);
    });
  });

  describe('PATCH /users/:id/approve', () => {
    it('should approve user', async () => {
      const approved = { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true };
      mockPrisma.user.update.mockResolvedValue(approved);

      const res = await request(app).patch('/users/usr-1/approve');

      expect(res.status).toBe(200);
      expect(res.body.isApproved).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isApproved: true } })
      );
    });
  });

  describe('PATCH /users/:id/revoke', () => {
    it('should return 404 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).patch('/users/nonexistent/revoke');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });

    it('should return 400 when trying to revoke admin user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'usr-1', email: 'admin@test.com', isApproved: true });

      const res = await request(app).patch('/users/usr-1/revoke');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot revoke admin user access');
    });

    it('should revoke user access successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'usr-2', email: 'user@test.com', isApproved: true });
      mockPrisma.user.update.mockResolvedValue({ id: 'usr-2', email: 'user@test.com', isApproved: false });

      const res = await request(app).patch('/users/usr-2/revoke');

      expect(res.status).toBe(200);
      expect(res.body.isApproved).toBe(false);
    });
  });

  describe('DELETE /users/:id', () => {
    it('should return 404 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).delete('/users/nonexistent');

      expect(res.status).toBe(404);
    });

    it('should return 400 when deleting approved user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'usr-2', email: 'user@test.com', isApproved: true });

      const res = await request(app).delete('/users/usr-2');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot delete an approved user. Revoke access first.');
    });

    it('should return 400 when deleting admin user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'usr-1', email: 'admin@test.com', isApproved: false });

      const res = await request(app).delete('/users/usr-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot delete admin user');
    });

    it('should delete unapproved non-admin user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'usr-3', email: 'pending@test.com', isApproved: false });

      const res = await request(app).delete('/users/usr-3');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User deleted successfully');
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'usr-3' } });
    });
  });
});
