import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockEventCreate = jest.fn();

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: {
    riegoEvent: {
      create: mockEventCreate,
    },
  },
}));

describe('RiegoEvent Service', () => {
  let logRiegoEvent;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('../../services/riegoEvent.js');
    logRiegoEvent = mod.logRiegoEvent;
  });

  describe('logRiegoEvent', () => {
    it('creates a STARTED event', async () => {
      mockEventCreate.mockResolvedValueOnce({ id: 'e-1' });

      const result = await logRiegoEvent('STARTED', 'fase-1', 'Jardín');

      expect(mockEventCreate).toHaveBeenCalledWith({
        data: {
          event: 'STARTED',
          phaseId: 'fase-1',
          phaseName: 'Jardín',
          stopReason: null,
          error: null,
          userId: null,
          details: null,
        },
      });
      expect(result).toEqual({ id: 'e-1' });
    });

    it('creates a STOPPED event with stopReason and userId', async () => {
      mockEventCreate.mockResolvedValueOnce({ id: 'e-2' });

      await logRiegoEvent('STOPPED', 'fase-2', 'Patio', {
        stopReason: 'manual',
        userId: 'usr-1',
      });

      expect(mockEventCreate).toHaveBeenCalledWith({
        data: {
          event: 'STOPPED',
          phaseId: 'fase-2',
          phaseName: 'Patio',
          stopReason: 'manual',
          error: null,
          userId: 'usr-1',
          details: null,
        },
      });
    });

    it('creates an ERROR event with error message', async () => {
      mockEventCreate.mockResolvedValueOnce({ id: 'e-3' });

      await logRiegoEvent('ERROR', 'fase-3', 'Huerto', {
        error: 'Shelly ON failed after 3 attempts',
      });

      expect(mockEventCreate).toHaveBeenCalledWith({
        data: {
          event: 'ERROR',
          phaseId: 'fase-3',
          phaseName: 'Huerto',
          stopReason: null,
          error: 'Shelly ON failed after 3 attempts',
          userId: null,
          details: null,
        },
      });
    });

    it('creates a STOPPED event with timeout reason', async () => {
      mockEventCreate.mockResolvedValueOnce({ id: 'e-4' });

      await logRiegoEvent('STOPPED', 'fase-4', 'Césped', {
        stopReason: 'timeout',
      });

      expect(mockEventCreate).toHaveBeenCalledWith({
        data: {
          event: 'STOPPED',
          phaseId: 'fase-4',
          phaseName: 'Césped',
          stopReason: 'timeout',
          error: null,
          userId: null,
          details: null,
        },
      });
    });

    it('handles empty options object', async () => {
      mockEventCreate.mockResolvedValueOnce({ id: 'e-5' });

      await logRiegoEvent('STARTED', 'fase-1', 'Jardín', {});

      expect(mockEventCreate).toHaveBeenCalledWith({
        data: {
          event: 'STARTED',
          phaseId: 'fase-1',
          phaseName: 'Jardín',
          stopReason: null,
          error: null,
          userId: null,
          details: null,
        },
      });
    });

    it('propagates errors from Prisma', async () => {
      const dbError = new Error('DB error');
      mockEventCreate.mockRejectedValueOnce(dbError);

      await expect(logRiegoEvent('STARTED', 'f-1', 'test')).rejects.toThrow('DB error');
    });
  });
});
