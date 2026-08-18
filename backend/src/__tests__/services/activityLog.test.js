import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockLogCreate = jest.fn();

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: {
    activityLog: {
      create: mockLogCreate,
    },
  },
}));

describe('ActivityLog Service', () => {
  let logActivity, ACTIONS;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('../../services/activityLog.js');
    logActivity = mod.logActivity;
    ACTIONS = mod.ACTIONS;
  });

  describe('ACTIONS', () => {
    it('has all expected action types', () => {
      expect(ACTIONS).toHaveProperty('DEVICE_TURNED_ON');
      expect(ACTIONS).toHaveProperty('DEVICE_TURNED_OFF');
      expect(ACTIONS).toHaveProperty('RIEGO_PHASE_STARTED');
      expect(ACTIONS).toHaveProperty('RIEGO_PHASE_STOPPED');
      expect(ACTIONS).toHaveProperty('RIEGO_PLAN_CREATED');
      expect(ACTIONS).toHaveProperty('RIEGO_PLAN_UPDATED');
      expect(ACTIONS).toHaveProperty('RIEGO_PLAN_DELETED');
      expect(ACTIONS).toHaveProperty('RIEGO_PLAN_TRIGGERED');
    });

    it('has exactly 9 action types', () => {
      expect(Object.keys(ACTIONS)).toHaveLength(9);
    });

    it('has unique action values', () => {
      const values = Object.values(ACTIONS);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('logActivity', () => {
    it('calls prisma.activityLog.create with correct data', async () => {
      mockLogCreate.mockResolvedValueOnce({ id: 'a-1' });

      const result = await logActivity('usr-1', 'DEVICE_TURNED_ON', 'dev-1', 'Light', { newState: true });

      expect(mockLogCreate).toHaveBeenCalledWith({
        data: {
          userId: 'usr-1',
          action: 'DEVICE_TURNED_ON',
          targetId: 'dev-1',
          targetName: 'Light',
          details: { newState: true },
        },
      });
      expect(result).toEqual({ id: 'a-1' });
    });

    it('defaults optional fields to null', async () => {
      mockLogCreate.mockResolvedValueOnce({ id: 'a-2' });

      await logActivity('usr-1', 'RIEGO_PHASE_STARTED');

      expect(mockLogCreate).toHaveBeenCalledWith({
        data: {
          userId: 'usr-1',
          action: 'RIEGO_PHASE_STARTED',
          targetId: null,
          targetName: null,
          details: null,
        },
      });
    });

    it('converts null userId to null for system events', async () => {
      mockLogCreate.mockResolvedValueOnce({ id: 'a-3' });

      await logActivity(null, 'DEVICE_TURNED_OFF');

      expect(mockLogCreate).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: 'DEVICE_TURNED_OFF',
          targetId: null,
          targetName: null,
          details: null,
        },
      });
    });

    it('propagates errors from Prisma', async () => {
      const dbError = new Error('DB error');
      mockLogCreate.mockRejectedValueOnce(dbError);

      await expect(logActivity('usr-1', 'CREATED')).rejects.toThrow('DB error');
    });

    it('logs riego plan creation with details', async () => {
      mockLogCreate.mockResolvedValueOnce({ id: 'a-4' });

      await logActivity('usr-1', ACTIONS.RIEGO_PLAN_CREATED, 'plan-1', 'Plan Matinal', { phasesCount: 3 });

      expect(mockLogCreate).toHaveBeenCalledWith({
        data: {
          userId: 'usr-1',
          action: ACTIONS.RIEGO_PLAN_CREATED,
          targetId: 'plan-1',
          targetName: 'Plan Matinal',
          details: { phasesCount: 3 },
        },
      });
    });
  });
});
