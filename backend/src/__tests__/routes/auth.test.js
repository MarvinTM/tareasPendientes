import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const authenticatedUser = { id: 'usr-1', email: 'test@test.com', name: 'Test User', isApproved: true, shortName: 'Test', color: '#000', picture: null };

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = authenticatedUser;
  next();
});
const mockGenerateToken = jest.fn(() => 'mock-jwt-token');

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
  generateToken: mockGenerateToken
}));

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: {
    user: {
      findUnique: jest.fn()
    }
  }
}));

const router = (await import('../../routes/auth.js')).default;
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', router);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req, res, next) => {
      req.user = authenticatedUser;
      next();
    });
  });

  describe('GET /me', () => {
    it('should return user data with admin flag', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('usr-1');
      expect(res.body.email).toBe('test@test.com');
      expect(res.body.name).toBe('Test User');
      expect(res.body.isApproved).toBe(true);
      expect(res.body).toHaveProperty('isAdmin');
    });

    it('should identify admin users by email', async () => {
      const adminUser = { ...authenticatedUser, email: 'admin@test.com' };
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = adminUser;
        next();
      });

      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.isAdmin).toBe(true);
    });

    it('should identify non-admin users', async () => {
      const nonAdminUser = { ...authenticatedUser, email: 'regular@example.com' };
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        req.user = nonAdminUser;
        next();
      });

      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.isAdmin).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      mockAuthenticateToken.mockImplementationOnce((req, res) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /status', () => {
    it('should return authenticated:false when no token', async () => {
      const res = await request(app).get('/api/auth/status');

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    it('should return authenticated:false for invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/status')
        .set('Cookie', 'token=invalid-token');

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    it('should return authenticated:true with user data for valid token', async () => {
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign({ userId: 'usr-1' }, process.env.JWT_SECRET);

      const { prisma } = await import('../../config/passport.js');
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-1', email: 'test@test.com', name: 'Test User',
        shortName: 'Test', color: '#000', picture: null, isApproved: true
      });

      const res = await request(app)
        .get('/api/auth/status')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.id).toBe('usr-1');
      expect(res.body.user.isAdmin).toBe(false);
    });

    it('should extract token from Authorization header', async () => {
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign({ userId: 'usr-1' }, process.env.JWT_SECRET);

      const { prisma } = await import('../../config/passport.js');
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true
      });

      const res = await request(app)
        .get('/api/auth/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
    });

    it('should return authenticated:false when user not found', async () => {
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign({ userId: 'nonexistent' }, process.env.JWT_SECRET);

      const { prisma } = await import('../../config/passport.js');
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/auth/status')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    it('should mark admin users as isAdmin:true', async () => {
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign({ userId: 'usr-1' }, process.env.JWT_SECRET);

      const { prisma } = await import('../../config/passport.js');
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-1', email: 'admin@test.com', name: 'Admin', isApproved: true
      });

      const res = await request(app)
        .get('/api/auth/status')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.isAdmin).toBe(true);
    });
  });

  describe('POST /logout', () => {
    it('should clear token cookie and return success', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
    });
  });
});
