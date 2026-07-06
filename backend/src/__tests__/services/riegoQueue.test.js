import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockEmitRiegoUpdate = jest.fn();

const mockLoadConfig = jest.fn();

jest.unstable_mockModule('../../socket.js', () => ({
  emitRiegoUpdate: mockEmitRiegoUpdate,
}));

jest.unstable_mockModule('../../services/shelly.js', () => ({
  loadConfig: mockLoadConfig,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const validConfig = {
  server: 'https://shelly-263-eu.shelly.cloud',
  apiKey: 'test-api-key',
  riego: {
    phases: [
      { id: 'fase-1', name: 'Jardín', shellyId: 'shelly-1', channel: 0 },
      { id: 'fase-2', name: 'Patio', shellyId: 'shelly-1', channel: 1 },
      { id: 'fase-3', name: 'Huerto', shellyId: 'shelly-2', channel: 0 },
      { id: 'fase-4', name: 'Césped', shellyId: 'shelly-2', channel: 1 },
    ],
  },
};

const flush = () => new Promise(r => setTimeout(r, 10));

describe('RiegoQueue', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockLoadConfig.mockReturnValue(validConfig);

    const { _reset } = await import('../../services/riegoQueue.js');
    _reset();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ isok: true }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startupSafetyCheck', () => {
    it('sends OFF to all unique Shelly+channel combinations', async () => {
      const { startupSafetyCheck } = await import('../../services/riegoQueue.js');
      await startupSafetyCheck();

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('handles fetch failures gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { startupSafetyCheck } = await import('../../services/riegoQueue.js');
      await expect(startupSafetyCheck()).resolves.not.toThrow();
    });
  });

  describe('emergencyStopAll', () => {
    it('stops current phase and clears queue', async () => {
      const { enqueue, emergencyStopAll } = await import('../../services/riegoQueue.js');
      enqueue('fase-1', 10);
      await flush();

      await emergencyStopAll();

      const { getState } = await import('../../services/riegoQueue.js');
      const state = getState();
      expect(state.current).toBeNull();
      expect(state.queue).toHaveLength(0);
    });

    it('stops all unique Shelly+channel combos', async () => {
      const { emergencyStopAll } = await import('../../services/riegoQueue.js');
      await emergencyStopAll();

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('enqueue', () => {
    it('adds to queue and starts immediately when empty', async () => {
      const { enqueue, getState } = await import('../../services/riegoQueue.js');
      enqueue('fase-1', 10);
      await flush();

      const state = getState();
      expect(state.current).not.toBeNull();
      expect(state.current.phaseId).toBe('fase-1');
      expect(state.current.durationMin).toBe(10);
      expect(state.queue).toHaveLength(0);
    });

    it('adds to queue when current is active', async () => {
      const { enqueue, getState } = await import('../../services/riegoQueue.js');
      enqueue('fase-1', 10);
      await flush();
      enqueue('fase-2', 5);

      const state = getState();
      expect(state.current.phaseId).toBe('fase-1');
      expect(state.queue).toHaveLength(1);
      expect(state.queue[0].phaseId).toBe('fase-2');
    });

    it('throws on unknown phaseId', async () => {
      const { enqueue } = await import('../../services/riegoQueue.js');
      expect(() => enqueue('unknown-phase', 10)).toThrow('Fase no encontrada');
    });

    it('throws on duration > 120 min', async () => {
      const { enqueue } = await import('../../services/riegoQueue.js');
      expect(() => enqueue('fase-1', 121)).toThrow('Duración inválida');
    });

    it('throws on duration <= 0', async () => {
      const { enqueue } = await import('../../services/riegoQueue.js');
      expect(() => enqueue('fase-1', 0)).toThrow('Duración inválida');
    });

    it('returns unique queueId per entry', async () => {
      const { enqueue } = await import('../../services/riegoQueue.js');
      const id1 = enqueue('fase-1', 10);
      const id2 = enqueue('fase-2', 5);
      expect(id1).not.toBe(id2);
    });

    it('emits riego:updated on enqueue', async () => {
      const { enqueue } = await import('../../services/riegoQueue.js');
      enqueue('fase-1', 10);
      await flush();

      expect(mockEmitRiegoUpdate).toHaveBeenCalled();
    });

    it('remembers last duration per phase', async () => {
      const { enqueue, getState } = await import('../../services/riegoQueue.js');
      enqueue('fase-1', 7);
      await flush();
      const state = getState();
      expect(state.durationMemory['fase-1']).toBe(7);
    });
  });

  describe('dequeue', () => {
    it('removes pending item from queue', async () => {
      const { enqueue, dequeue, getState } = await import('../../services/riegoQueue.js');
      enqueue('fase-1', 10);
      await flush();
      const q2 = enqueue('fase-2', 5);

      expect(getState().queue).toHaveLength(1);
      dequeue(q2);
      expect(getState().queue).toHaveLength(0);
    });

    it('no-ops on current active item', async () => {
      const { enqueue, dequeue, getState } = await import('../../services/riegoQueue.js');
      enqueue('fase-1', 10);
      await flush();
      const state = getState();
      const q1 = state.current.queueId;

      const result = dequeue(q1);
      expect(result).toBe(false);
      expect(getState().current).not.toBeNull();
    });

    it('returns false for invalid queueId', async () => {
      const { dequeue } = await import('../../services/riegoQueue.js');
      expect(dequeue('nonexistent')).toBe(false);
    });
  });

  describe('stopCurrent', () => {
    it('sends Shelly OFF and clears current', async () => {
      const { enqueue, stopCurrent, getState } = await import('../../services/riegoQueue.js');
      enqueue('fase-1', 10);
      await flush();

      expect(getState().current).not.toBeNull();

      mockFetch.mockClear();

      await stopCurrent();
      await flush();

      expect(mockFetch).toHaveBeenCalled();
      // First call should be an OFF command
      const offCall = mockFetch.mock.calls[0][1].body.toString();
      expect(offCall).toContain('turn=off');
    }, 15000);

    it('clears current when nothing in queue', async () => {
      const { enqueue, stopCurrent, getState } = await import('../../services/riegoQueue.js');
      enqueue('fase-1', 1);
      await flush();

      expect(getState().current).not.toBeNull();

      await stopCurrent();
      await flush();

      const state = getState();
      expect(state.current).toBeNull();
    }, 15000);

    it('no-ops when nothing active', async () => {
      const { stopCurrent, getState } = await import('../../services/riegoQueue.js');
      await stopCurrent();
      expect(getState().current).toBeNull();
    });

    it('retries OFF on network failure', async () => {
      const { enqueue, stopCurrent } = await import('../../services/riegoQueue.js');
      enqueue('fase-1', 1);
      await flush();

      mockFetch.mockReset();
      mockFetch
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ isok: true }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ isok: true }) });

      await stopCurrent();
      await flush();

      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 15000);
  });

  describe('getState', () => {
    it('returns empty state initially', async () => {
      const { getState } = await import('../../services/riegoQueue.js');
      const state = getState();

      expect(state.current).toBeNull();
      expect(state.queue).toHaveLength(0);
      expect(state.phases).toHaveLength(4);
    });

    it('computes remaining seconds for active phase', async () => {
      const { enqueue, getState } = await import('../../services/riegoQueue.js');
      enqueue('fase-1', 10);
      await flush();

      const state = getState();
      expect(state.current.remaining).toBeGreaterThan(500);
    });
  });

  describe('watchdog', () => {
    it('has watchdog registered', async () => {
      jest.useFakeTimers();
      jest.spyOn(global, 'setInterval');

      const { init } = await import('../../services/riegoQueue.js');
      init();

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        15000
      );
    });
  });

  describe('getPhases (via getState)', () => {
    it('returns empty phases when riego section missing', async () => {
      mockLoadConfig.mockReturnValue({ server: 'x', apiKey: 'x', devices: [] });

      const { getState } = await import('../../services/riegoQueue.js');
      const state = getState();
      expect(state.phases).toHaveLength(0);
    });
  });
});
