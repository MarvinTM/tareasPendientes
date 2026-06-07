import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { requireAdmin } from '../../middleware/admin.js';

describe('Admin Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('requireAdmin', () => {
    it('should return 401 when req.user is null (not authenticated)', () => {
      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when req.user is undefined', () => {
      mockReq.user = undefined;

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not an admin', () => {
      mockReq.user = { email: 'regular@example.com' };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next when user is an admin', () => {
      mockReq.user = { email: 'admin@test.com' };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should call next when user is a super admin', () => {
      mockReq.user = { email: 'superadmin@test.com' };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive email matching (uppercase)', () => {
      mockReq.user = { email: 'ADMIN@TEST.COM' };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle case-insensitive email matching (mixed case)', () => {
      mockReq.user = { email: 'Admin@Test.Com' };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle email with surrounding whitespace in env var', () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = ' , admin@test.com , superadmin@test.com  ';
      mockReq.user = { email: 'admin@test.com' };

      // Re-import doesn't work synchronously for ESM, but the function reads env at call time
      requireAdmin(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      process.env.ADMIN_EMAILS = originalEnv;
    });

    it('should reject empty string email', () => {
      mockReq.user = { email: '' };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Admin access required' });
    });

    it('should not include the admin in the error response body', () => {
      mockReq.user = { email: 'hacker@evil.com' };

      requireAdmin(mockReq, mockRes, mockNext);

      const errorBody = mockRes.json.mock.calls[0][0];
      expect(errorBody.error).not.toContain('admin@test.com');
      expect(errorBody.error).not.toContain('superadmin@test.com');
    });
  });
});
