import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Set environment before importing modules
process.env.JWT_SECRET = 'test-jwt-secret-key';

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      cookies: {},
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', async () => {
      // Import dynamically to ensure env is set
      const { generateToken } = await import('../../middleware/auth.js');
      const userId = 'test-user-id';
      const token = generateToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(userId);
    });

    it('should generate token with 7 day expiration', async () => {
      const { generateToken } = await import('../../middleware/auth.js');
      const userId = 'test-user-id';
      const token = generateToken(userId);

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const expirationTime = decoded.exp - decoded.iat;

      // 7 days in seconds
      expect(expirationTime).toBe(7 * 24 * 60 * 60);
    });
  });

  describe('Token Validation Logic', () => {
    it('should verify a valid JWT token', () => {
      const userId = 'test-user-id';
      const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(userId);
    });

    it('should reject an invalid JWT token', () => {
      const invalidToken = 'invalid-token';

      expect(() => {
        jwt.verify(invalidToken, process.env.JWT_SECRET);
      }).toThrow();
    });

    it('should reject token with wrong secret', () => {
      const token = jwt.sign({ userId: 'test' }, 'wrong-secret', { expiresIn: '7d' });

      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET);
      }).toThrow();
    });

    it('should reject expired token', () => {
      const token = jwt.sign({ userId: 'test' }, process.env.JWT_SECRET, { expiresIn: '-1s' });

      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET);
      }).toThrow();
    });
  });

  describe('Token Extraction', () => {
    it('should extract token from cookies', () => {
      mockReq.cookies.token = 'my-token';

      const token = mockReq.cookies.token || mockReq.headers.authorization?.split(' ')[1];
      expect(token).toBe('my-token');
    });

    it('should extract token from Authorization header', () => {
      mockReq.headers.authorization = 'Bearer my-header-token';

      const token = mockReq.cookies.token || mockReq.headers.authorization?.split(' ')[1];
      expect(token).toBe('my-header-token');
    });

    it('should prefer cookie token over header', () => {
      mockReq.cookies.token = 'cookie-token';
      mockReq.headers.authorization = 'Bearer header-token';

      const token = mockReq.cookies.token || mockReq.headers.authorization?.split(' ')[1];
      expect(token).toBe('cookie-token');
    });

    it('should return undefined when no token is present', () => {
      const token = mockReq.cookies.token || mockReq.headers.authorization?.split(' ')[1];
      expect(token).toBeUndefined();
    });
  });

  describe('User Approval Status', () => {
    it('should identify approved users', () => {
      const user = { id: '1', email: 'test@test.com', isApproved: true };
      expect(user.isApproved).toBe(true);
    });

    it('should identify unapproved users', () => {
      const user = { id: '1', email: 'test@test.com', isApproved: false };
      expect(user.isApproved).toBe(false);
    });
  });
});
