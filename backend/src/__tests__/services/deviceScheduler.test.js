import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockTurnDeviceOn = jest.fn();
const mockTurnDeviceOff = jest.fn();
const mockGetDeviceById = jest.fn();
const mockEmitDeviceUpdate = jest.fn();
const mockLogActivity = jest.fn().mockResolvedValue();

jest.unstable_mockModule('../../services/shelly.js', () => ({
  turnDeviceOn: mockTurnDeviceOn,
  turnDeviceOff: mockTurnDeviceOff,
  getDeviceById: mockGetDeviceById,
}));

jest.unstable_mockModule('../../services/activityLog.js', () => ({
  logActivity: mockLogActivity,
  ACTIONS: {
    DEVICE_TURNED_ON: 'DEVICE_TURNED_ON',
    DEVICE_TURNED_OFF: 'DEVICE_TURNED_OFF',
  },
}));

jest.unstable_mockModule('../../socket.js', () => ({
  emitDeviceUpdate: mockEmitDeviceUpdate,
}));

const mockActivationFindMany = jest.fn();

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: {
    deviceActivation: {
      findMany: mockActivationFindMany,
    },
  },
}));

describe('DeviceScheduler', () => {
  let _tick, init, _reset;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('../../services/deviceScheduler.js');
    _tick = mod._tick;
    init = mod.init;
    _reset = mod._reset;
  });

  afterEach(() => {
    _reset();
  });

  describe('init', () => {
    it('starts the scheduler', () => {
      init();
      _reset();
    });
  });

  describe('_tick', () => {
    const testTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    it('turns on device when activationTime matches current time', async () => {
      const device = { id: 'dev-1', name: 'Light' };
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${h}:${m}`;

      mockActivationFindMany.mockResolvedValue([{
        deviceId: 'dev-1',
        planId: 'p-1',
        plan: { id: 'p-1', name: 'Morning', activationTime: currentTime, deactivationTime: '23:00', timezone: testTz },
      }]);
      mockGetDeviceById.mockReturnValue(device);
      mockTurnDeviceOn.mockResolvedValue({ on: true });

      await _tick();

      expect(mockTurnDeviceOn).toHaveBeenCalledWith('dev-1');
      expect(mockEmitDeviceUpdate).toHaveBeenCalledWith({
        id: 'dev-1', ...device, on: true,
      });
      expect(mockLogActivity).toHaveBeenCalledWith(
        null, 'DEVICE_TURNED_ON', 'dev-1', 'Light',
        { scheduled: true, planId: 'p-1', planName: 'Morning' }
      );
    });

    it('turns off device when deactivationTime matches current time', async () => {
      const device = { id: 'dev-2', name: 'Pump' };
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${h}:${m}`;

      mockActivationFindMany.mockResolvedValue([{
        deviceId: 'dev-2',
        planId: 'p-2',
        plan: { id: 'p-2', name: 'Evening', activationTime: '06:00', deactivationTime: currentTime, timezone: testTz },
      }]);
      mockGetDeviceById.mockReturnValue(device);
      mockTurnDeviceOff.mockResolvedValue({ on: false });

      await _tick();

      expect(mockTurnDeviceOff).toHaveBeenCalledWith('dev-2');
      expect(mockLogActivity).toHaveBeenCalledWith(
        null, 'DEVICE_TURNED_OFF', 'dev-2', 'Pump',
        { scheduled: true, planId: 'p-2', planName: 'Evening' }
      );
    });

    it('skips device when time does not match', async () => {
      mockActivationFindMany.mockResolvedValue([{
        deviceId: 'dev-1',
        planId: 'p-1',
        plan: { id: 'p-1', name: 'Morning', activationTime: '04:00', deactivationTime: '05:00', timezone: testTz },
      }]);

      await _tick();

      expect(mockTurnDeviceOn).not.toHaveBeenCalled();
      expect(mockTurnDeviceOff).not.toHaveBeenCalled();
    });

    it('skips device when not found in config', async () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${h}:${m}`;

      mockActivationFindMany.mockResolvedValue([{
        deviceId: 'unknown',
        planId: 'p-1',
        plan: { id: 'p-1', name: 'Morning', activationTime: currentTime, deactivationTime: '12:00', timezone: testTz },
      }]);
      mockGetDeviceById.mockReturnValue(null);

      await _tick();

      expect(mockTurnDeviceOn).not.toHaveBeenCalled();
    });

    it('handles turnDeviceOn failure gracefully', async () => {
      const device = { id: 'dev-1', name: 'Light' };
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${h}:${m}`;

      mockActivationFindMany.mockResolvedValue([{
        deviceId: 'dev-1',
        planId: 'p-1',
        plan: { id: 'p-1', name: 'Morning', activationTime: currentTime, deactivationTime: '12:00', timezone: testTz },
      }]);
      mockGetDeviceById.mockReturnValue(device);
      mockTurnDeviceOn.mockRejectedValue(new Error('Shelly error'));

      await _tick();

      expect(mockLogActivity).not.toHaveBeenCalled();
    });
  });
});
