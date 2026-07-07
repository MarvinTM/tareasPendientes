import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const authenticatedUser = { id: 'usr-1', email: 'test@test.com', name: 'Test User', isApproved: true };

const mockTaskHistory = { findMany: jest.fn() };
const mockActivityLog = { findMany: jest.fn() };

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: {
    taskHistory: mockTaskHistory,
    activityLog: mockActivityLog,
  },
}));

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = authenticatedUser;
  next();
});

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
}));

describe('Activity Routes', () => {
  let app;

  beforeEach(async () => {
    jest.clearAllMocks();
    const { default: activityRoutes } = await import('../../routes/activity.js');
    app = express();
    app.use(express.json());
    app.use('/api/activity', activityRoutes);
  });

  describe('GET /', () => {
    it('returns merged timeline with entries from both sources', async () => {
      const taskEntry = {
        id: 't-1', taskId: 'task-1', userId: 'usr-2', action: 'CREATED',
        previousValue: null, newValue: null,
        timestamp: new Date('2025-01-01T12:00:00Z'),
        user: { id: 'usr-2', name: 'User 2', shortName: null, color: null, picture: null },
        task: { id: 'task-1', title: 'Test Task' },
      };
      const activityEntry = {
        id: 'a-1', userId: 'usr-1', action: 'DEVICE_TURNED_ON',
        targetId: 'dev-1', targetName: 'Light', details: { newState: true },
        timestamp: new Date('2025-01-01T11:00:00Z'),
        user: { id: 'usr-1', name: 'User 1', shortName: null, color: null, picture: null },
      };

      mockTaskHistory.findMany.mockResolvedValueOnce([taskEntry]);
      mockActivityLog.findMany.mockResolvedValueOnce([activityEntry]);

      const res = await request(app).get('/api/activity');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(2);
      expect(res.body.entries[0].type).toBe('task');
      expect(res.body.hasMore).toBe(false);
    });

    it('respects before cursor for pagination', async () => {
      mockTaskHistory.findMany.mockResolvedValueOnce([]);
      mockActivityLog.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/activity')
        .query({ before: '2025-01-01T12:00:00Z' });

      expect(res.status).toBe(200);
      expect(mockTaskHistory.findMany).toHaveBeenCalled();
      const taskWhere = mockTaskHistory.findMany.mock.calls[0][0].where;
      expect(taskWhere.timestamp.lt).toBeInstanceOf(Date);

      expect(mockActivityLog.findMany).toHaveBeenCalled();
      const activityWhere = mockActivityLog.findMany.mock.calls[0][0].where;
      expect(activityWhere.timestamp.lt).toBeInstanceOf(Date);
    });

    it('returns hasMore true when entries exceed limit', async () => {
      const entries = Array.from({ length: 16 }, (_, i) => ({
        id: `a-${i}`, userId: 'usr-1', action: 'DEVICE_TURNED_ON',
        targetId: 'dev-1', targetName: 'Light', details: null,
        timestamp: new Date(`2025-01-01T${10 + i}:00:00Z`),
        user: { id: 'usr-1', name: 'User 1', shortName: null, color: null, picture: null },
      }));

      mockTaskHistory.findMany.mockResolvedValueOnce([]);
      mockActivityLog.findMany.mockResolvedValueOnce(entries);

      const res = await request(app).get('/api/activity?limit=15');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(15);
      expect(res.body.hasMore).toBe(true);
      expect(res.body.nextCursor).toBeTruthy();
    });

    it('sorts merged entries by timestamp descending', async () => {
      mockTaskHistory.findMany.mockResolvedValueOnce([{
        id: 't-1', taskId: 'task-1', userId: 'usr-2', action: 'CREATED',
        previousValue: null, newValue: null,
        timestamp: new Date('2025-01-01T10:00:00Z'),
        user: { id: 'usr-2', name: 'User 2', shortName: null, color: null, picture: null },
        task: { id: 'task-1', title: 'Test Task' },
      }]);
      mockActivityLog.findMany.mockResolvedValueOnce([{
        id: 'a-1', userId: 'usr-1', action: 'DEVICE_TURNED_ON',
        targetId: 'dev-1', targetName: 'Light', details: null,
        timestamp: new Date('2025-01-01T12:00:00Z'),
        user: { id: 'usr-1', name: 'User 1', shortName: null, color: null, picture: null },
      }]);

      const res = await request(app).get('/api/activity');

      expect(res.status).toBe(200);
      expect(res.body.entries[0].type).toBe('activity');
      expect(res.body.entries[1].type).toBe('task');
    });

    it('returns 500 on database error', async () => {
      mockTaskHistory.findMany.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/activity');

      expect(res.status).toBe(500);
    });

    it('respects custom limit parameter', async () => {
      mockTaskHistory.findMany.mockResolvedValueOnce([]);
      mockActivityLog.findMany.mockResolvedValueOnce([]);

      await request(app).get('/api/activity?limit=10');

      expect(mockTaskHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 11 })
      );
      expect(mockActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 11 })
      );
    });

    it('caps limit at 100', async () => {
      mockTaskHistory.findMany.mockResolvedValueOnce([]);
      mockActivityLog.findMany.mockResolvedValueOnce([]);

      await request(app).get('/api/activity?limit=200');

      expect(mockTaskHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 })
      );
    });

    it('returns empty entries when no data', async () => {
      mockTaskHistory.findMany.mockResolvedValueOnce([]);
      mockActivityLog.findMany.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/activity');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(0);
      expect(res.body.hasMore).toBe(false);
    });

    it('maps task history entries with type task', async () => {
      mockTaskHistory.findMany.mockResolvedValueOnce([{
        id: 't-1', taskId: 'task-1', userId: 'usr-2', action: 'CREATED',
        previousValue: null, newValue: 'Task title',
        timestamp: new Date('2025-01-01T12:00:00Z'),
        user: { id: 'usr-2', name: 'User 2', shortName: null, color: null, picture: null },
        task: { id: 'task-1', title: 'Test Task' },
      }]);
      mockActivityLog.findMany.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/activity');

      const entry = res.body.entries[0];
      expect(entry.type).toBe('task');
      expect(entry.taskId).toBe('task-1');
      expect(entry.task).toEqual({ id: 'task-1', title: 'Test Task' });
      expect(entry.previousValue).toBeNull();
      expect(entry.newValue).toBe('Task title');
    });

    it('maps activity log entries with type activity', async () => {
      mockTaskHistory.findMany.mockResolvedValueOnce([]);
      mockActivityLog.findMany.mockResolvedValueOnce([{
        id: 'a-1', userId: 'usr-1', action: 'DEVICE_TURNED_ON',
        targetId: 'dev-1', targetName: 'Light', details: { newState: true },
        timestamp: new Date('2025-01-01T12:00:00Z'),
        user: { id: 'usr-1', name: 'User 1', shortName: null, color: null, picture: null },
      }]);

      const res = await request(app).get('/api/activity');

      const entry = res.body.entries[0];
      expect(entry.type).toBe('activity');
      expect(entry.targetId).toBe('dev-1');
      expect(entry.targetName).toBe('Light');
      expect(entry.details).toEqual({ newState: true });
    });
  });
});
