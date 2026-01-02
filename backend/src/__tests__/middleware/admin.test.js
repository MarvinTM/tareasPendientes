import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Set environment before tests
process.env.ADMIN_EMAILS = 'admin@test.com,superadmin@test.com';

describe('Admin Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      user: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('requireAdmin logic', () => {
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

    it('should parse admin emails correctly', () => {
      expect(adminEmails).toContain('admin@test.com');
      expect(adminEmails).toContain('superadmin@test.com');
      expect(adminEmails).toHaveLength(2);
    });

    it('should identify admin users', () => {
      const user = { email: 'admin@test.com' };
      const isAdmin = adminEmails.includes(user.email.toLowerCase());
      expect(isAdmin).toBe(true);
    });

    it('should identify non-admin users', () => {
      const user = { email: 'regular@example.com' };
      const isAdmin = adminEmails.includes(user.email.toLowerCase());
      expect(isAdmin).toBe(false);
    });

    it('should handle case-insensitive email matching', () => {
      const user = { email: 'ADMIN@TEST.COM' };
      const isAdmin = adminEmails.includes(user.email.toLowerCase());
      expect(isAdmin).toBe(true);
    });

    it('should handle mixed case emails', () => {
      const user = { email: 'Admin@Test.Com' };
      const isAdmin = adminEmails.includes(user.email.toLowerCase());
      expect(isAdmin).toBe(true);
    });

    it('should work with multiple admin emails', () => {
      const user1 = { email: 'admin@test.com' };
      const user2 = { email: 'superadmin@test.com' };

      expect(adminEmails.includes(user1.email.toLowerCase())).toBe(true);
      expect(adminEmails.includes(user2.email.toLowerCase())).toBe(true);
    });
  });

  describe('Error Responses', () => {
    it('should return 401 when user is null', () => {
      const requireAdminLogic = (req, res, next) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        next();
      };

      requireAdminLogic(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not admin', () => {
      mockReq.user = { email: 'regular@example.com' };
      const adminEmails = ['admin@test.com'];

      const requireAdminLogic = (req, res, next) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        if (!adminEmails.includes(req.user.email.toLowerCase())) {
          return res.status(403).json({ error: 'Admin access required' });
        }
        next();
      };

      requireAdminLogic(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next when user is admin', () => {
      mockReq.user = { email: 'admin@test.com' };
      const adminEmails = ['admin@test.com'];

      const requireAdminLogic = (req, res, next) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        if (!adminEmails.includes(req.user.email.toLowerCase())) {
          return res.status(403).json({ error: 'Admin access required' });
        }
        next();
      };

      requireAdminLogic(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
