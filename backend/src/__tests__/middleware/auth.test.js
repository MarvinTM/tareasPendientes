import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

const mockFindUnique = jest.fn();
jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique
    }
  }
}));

const { authenticateToken, generateToken } = await import('../../middleware/auth.js');

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
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
    it('should generate a valid JWT token', () => {
      const userId = 'test-user-id';
      const token = generateToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(userId);
    });

    it('should generate token with 7 day expiration', () => {
      const userId = 'test-user-id';
      const token = generateToken(userId);

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const expirationTime = decoded.exp - decoded.iat;

      expect(expirationTime).toBe(7 * 24 * 60 * 60);
    });

    it('should generate different tokens for different users', () => {
      const token1 = generateToken('user-1');
      const token2 = generateToken('user-2');

      expect(token1).not.toBe(token2);
    });
  });

  describe('authenticateToken', () => {
    it('should return 401 when no token is provided', async () => {
      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract token from cookies', async () => {
      const userId = 'user-1';
      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      mockReq.cookies.token = token;

      mockFindUnique.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        isApproved: true
      });

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user.id).toBe(userId);
    });

    it('should extract token from Authorization header', async () => {
      const userId = 'user-2';
      const token = jwt.sign({ userId }, process.env.JWT_SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;

      mockFindUnique.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        isApproved: true
      });

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user.id).toBe(userId);
    });

    it('should prefer cookie token over header token', async () => {
      const cookieUserId = 'cookie-user';
      const headerUserId = 'header-user';
      const cookieToken = jwt.sign({ userId: cookieUserId }, process.env.JWT_SECRET);
      const headerToken = jwt.sign({ userId: headerUserId }, process.env.JWT_SECRET);

      mockReq.cookies.token = cookieToken;
      mockReq.headers.authorization = `Bearer ${headerToken}`;

      mockFindUnique.mockResolvedValue({
        id: cookieUserId,
        email: 'test@test.com',
        isApproved: true
      });

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockReq.user.id).toBe(cookieUserId);
    });

    it('should return 401 for invalid token', async () => {
      mockReq.cookies.token = 'invalid-token';

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test' },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );

      mockReq.cookies.token = expiredToken;

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not found in database', async () => {
      const token = jwt.sign({ userId: 'nonexistent' }, process.env.JWT_SECRET);
      mockReq.cookies.token = token;

      mockFindUnique.mockResolvedValue(null);

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found' });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent' }
      });
    });

    it('should return 403 when user is not approved', async () => {
      const token = jwt.sign({ userId: 'unapproved' }, process.env.JWT_SECRET);
      mockReq.cookies.token = token;

      mockFindUnique.mockResolvedValue({
        id: 'unapproved',
        email: 'test@test.com',
        isApproved: false
      });

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Account pending approval' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set req.user and call next for approved user', async () => {
      const user = {
        id: 'approved-user',
        email: 'approved@test.com',
        name: 'Test User',
        isApproved: true
      };

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
      mockReq.cookies.token = token;

      mockFindUnique.mockResolvedValue(user);

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual(user);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 for token signed with wrong secret', async () => {
      const token = jwt.sign({ userId: 'test' }, 'wrong-secret');
      mockReq.cookies.token = token;

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
