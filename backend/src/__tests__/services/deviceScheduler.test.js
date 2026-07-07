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

const mockGetTimes = jest.fn();

jest.unstable_mockModule('suncalc', () => ({
  default: { getTimes: mockGetTimes },
}));

describe('DeviceScheduler', () => {
  let _tick, init, _reset;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetTimes.mockReturnValue({
      sunrise: new Date(2000, 0, 1, 7, 15),
      sunset: new Date(2000, 0, 1, 21, 30),
    });
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
    function makePlan(overrides = {}) {
      return {
        deviceId: 'dev-1',
        planId: 'p-1',
        plan: {
          id: 'p-1',
          name: 'Test Plan',
          activationMode: 'fixed',
          deactivationMode: 'fixed',
          activationTime: '04:00',
          deactivationTime: '05:00',
          timezone: 'Europe/Madrid',
          ...overrides,
        },
      };
    }

    it('turns on device when activationTime matches current time (fixed mode)', async () => {
      const device = { id: 'dev-1', name: 'Light' };
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${h}:${m}`;

      mockActivationFindMany.mockResolvedValue([makePlan({ activationTime: currentTime, deactivationTime: '23:00' })]);
      mockGetDeviceById.mockReturnValue(device);
      mockTurnDeviceOn.mockResolvedValue({ on: true });

      await _tick();

      expect(mockTurnDeviceOn).toHaveBeenCalledWith('dev-1');
    });

    it('turns off device when deactivationTime matches current time (fixed mode)', async () => {
      const device = { id: 'dev-2', name: 'Pump' };
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${h}:${m}`;

      mockActivationFindMany.mockResolvedValue([{ ...makePlan({ activationTime: '06:00', deactivationTime: currentTime }), deviceId: 'dev-2' }]);
      mockGetDeviceById.mockReturnValue(device);
      mockTurnDeviceOff.mockResolvedValue({ on: false });

      await _tick();

      expect(mockTurnDeviceOff).toHaveBeenCalledWith('dev-2');
    });

    it('skips device when time does not match (fixed mode)', async () => {
      mockActivationFindMany.mockResolvedValue([makePlan()]);

      await _tick();

      expect(mockTurnDeviceOn).not.toHaveBeenCalled();
      expect(mockTurnDeviceOff).not.toHaveBeenCalled();
    });

    it('skips device when not found in config', async () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${h}:${m}`;

      mockActivationFindMany.mockResolvedValue([makePlan({ activationTime: currentTime, deactivationTime: '12:00' })]);
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

      mockActivationFindMany.mockResolvedValue([makePlan({ activationTime: currentTime, deactivationTime: '12:00' })]);
      mockGetDeviceById.mockReturnValue(device);
      mockTurnDeviceOn.mockRejectedValue(new Error('Shelly error'));

      await _tick();

      expect(mockLogActivity).not.toHaveBeenCalled();
    });

    it('turns on device when activationMode is sunrise and localTime matches sunrise', async () => {
      const device = { id: 'dev-1', name: 'Light' };
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${h}:${m}`;

      mockGetTimes.mockReturnValue({
        sunrise: now,
        sunset: new Date(2000, 0, 1, 21, 30),
      });

      mockActivationFindMany.mockResolvedValue([makePlan({ activationMode: 'sunrise', activationTime: '00:00' })]);
      mockGetDeviceById.mockReturnValue(device);
      mockTurnDeviceOn.mockResolvedValue({ on: true });

      await _tick();

      expect(mockTurnDeviceOn).toHaveBeenCalledWith('dev-1');
    });

    it('turns off device when deactivationMode is sunset and localTime matches sunset', async () => {
      const device = { id: 'dev-2', name: 'Light' };
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${h}:${m}`;

      mockGetTimes.mockReturnValue({
        sunrise: new Date(2000, 0, 1, 7, 0),
        sunset: now,
      });

      mockActivationFindMany.mockResolvedValue([{ ...makePlan({ deactivationMode: 'sunset', deactivationTime: '00:00' }), deviceId: 'dev-2' }]);
      mockGetDeviceById.mockReturnValue(device);
      mockTurnDeviceOff.mockResolvedValue({ on: false });

      await _tick();

      expect(mockTurnDeviceOff).toHaveBeenCalledWith('dev-2');
    });

    it('does not trigger sunrise mode when local time does not match sunrise', async () => {
      const device = { id: 'dev-1', name: 'Light' };
      mockGetTimes.mockReturnValue({
        sunrise: new Date(2000, 0, 1, 4, 0),
        sunset: new Date(2000, 0, 1, 21, 0),
      });

      mockActivationFindMany.mockResolvedValue([makePlan({ activationMode: 'sunrise', activationTime: '00:00' })]);
      mockGetDeviceById.mockReturnValue(device);

      await _tick();

      expect(mockTurnDeviceOn).not.toHaveBeenCalled();
    });

    it('treats missing activationMode as fixed', async () => {
      const device = { id: 'dev-1', name: 'Light' };
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${h}:${m}`;

      mockActivationFindMany.mockResolvedValue([{
        deviceId: 'dev-1',
        planId: 'p-1',
        plan: { id: 'p-1', name: 'Legacy', activationTime: currentTime, deactivationTime: '23:00', timezone: 'Europe/Madrid' },
      }]);
      mockGetDeviceById.mockReturnValue(device);
      mockTurnDeviceOn.mockResolvedValue({ on: true });

      await _tick();

      expect(mockTurnDeviceOn).toHaveBeenCalledWith('dev-1');
    });
  });
});
