import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockIsLocalControlAvailable = jest.fn();
const mockSendLocalCommand = jest.fn();

jest.unstable_mockModule('../../services/localCommands.js', () => ({
  isLocalControlAvailable: mockIsLocalControlAvailable,
  sendLocalCommand: mockSendLocalCommand,
}));

// Serve the config from memory: other suites rewrite config/shelly.json on
// disk, and Jest runs files in parallel.
jest.unstable_mockModule('fs', () => ({
  existsSync: () => true,
  readFileSync: () => JSON.stringify(validConfig),
}));

const validConfig = {
  server: 'https://shelly-263-eu.shelly.cloud',
  apiKey: 'test-api-key',
  groups: [],
  devices: [
    { id: 'luces', shellyId: 'pro2', name: 'Luces', channel: 1 },
    { id: 'puerta', shellyId: 'mini', name: 'Puerta', channel: 0, controlMode: 'pulse' },
  ],
};

const cloudOk = () => ({ ok: true, json: async () => ({ isok: true }) });
const cloudStatus = (relays) => ({
  ok: true,
  json: async () => ({ isok: true, data: { online: true, device_status: { relays } } }),
});

describe('Shelly local-first control', () => {
  let shelly;
  let localStatus;

  beforeEach(async () => {
    jest.resetModules();
    mockFetch.mockReset();
    mockIsLocalControlAvailable.mockReset().mockReturnValue(true);
    mockSendLocalCommand.mockReset();

    localStatus = await import('../../services/shellyLocalStatus.js');
    localStatus._reset();
    shelly = await import('../../services/shelly.js');
  });

  describe('turnDeviceOn', () => {
    it('switches locally without touching the cloud', async () => {
      localStatus.updateShellyStatus([{ shellyId: 'pro2', online: true, relays: [{ on: false }, { on: false }] }]);
      mockSendLocalCommand.mockResolvedValue({ delivered: true, ok: true, on: true });

      await expect(shelly.turnDeviceOn('luces')).resolves.toEqual({ on: true });

      expect(mockSendLocalCommand).toHaveBeenCalledWith({ shellyId: 'pro2', channel: 1, action: 'on' });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(localStatus.getShellyStatus('pro2').relays[1]).toEqual({ on: true });
    });

    it('falls back to the cloud when the local command fails', async () => {
      mockSendLocalCommand.mockResolvedValue({ delivered: true, ok: false, error: 'HTTP 500' });
      mockFetch
        .mockResolvedValueOnce(cloudOk())
        .mockResolvedValueOnce(cloudStatus([{ ison: false }, { ison: true }]));

      await expect(shelly.turnDeviceOn('luces')).resolves.toEqual({ on: true });
      expect(mockFetch.mock.calls[0][1].body.toString()).toContain('turn=on');
    });

    it('goes straight to the cloud when the local component is not connected', async () => {
      mockIsLocalControlAvailable.mockReturnValue(false);
      mockFetch
        .mockResolvedValueOnce(cloudOk())
        .mockResolvedValueOnce(cloudStatus([{ ison: false }, { ison: true }]));

      await shelly.turnDeviceOn('luces');
      expect(mockSendLocalCommand).not.toHaveBeenCalled();
    });
  });

  describe('turnDeviceOff', () => {
    it('switches locally', async () => {
      mockSendLocalCommand.mockResolvedValue({ delivered: true, ok: true, on: false });
      await expect(shelly.turnDeviceOff('luces')).resolves.toEqual({ on: false });
      expect(mockSendLocalCommand).toHaveBeenCalledWith({ shellyId: 'pro2', channel: 1, action: 'off' });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('toggleDevice', () => {
    it('resolves the toggle to an explicit state from the local status', async () => {
      localStatus.updateShellyStatus([{ shellyId: 'pro2', online: true, relays: [{ on: false }, { on: true }] }]);
      mockSendLocalCommand.mockResolvedValue({ delivered: true, ok: true, on: false });

      await expect(shelly.toggleDevice('luces')).resolves.toEqual({ on: false });
      expect(mockSendLocalCommand).toHaveBeenCalledWith({ shellyId: 'pro2', channel: 1, action: 'off' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('uses the cloud toggle when the current state is unknown', async () => {
      mockFetch
        .mockResolvedValueOnce(cloudOk())
        .mockResolvedValue(cloudStatus([{ ison: false }, { ison: true }]));

      await shelly.toggleDevice('luces');
      expect(mockSendLocalCommand).not.toHaveBeenCalled();
      expect(mockFetch.mock.calls[0][1].body.toString()).toContain('turn=toggle');
    });
  });

  describe('pulseDevice', () => {
    it('pulses locally', async () => {
      mockSendLocalCommand.mockResolvedValue({ delivered: true, ok: true });
      await expect(shelly.pulseDevice('puerta')).resolves.toEqual({ triggered: true });
      expect(mockSendLocalCommand).toHaveBeenCalledWith({ shellyId: 'mini', channel: 0, action: 'pulse' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('uses the cloud when the command never reached the local component', async () => {
      mockSendLocalCommand.mockResolvedValue({ delivered: false, ok: false, error: 'not picked up' });
      mockFetch.mockResolvedValueOnce(cloudOk());

      await expect(shelly.pulseDevice('puerta')).resolves.toEqual({ triggered: true });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not pulse again through the cloud once delivered locally', async () => {
      mockSendLocalCommand.mockResolvedValue({ delivered: true, ok: false, error: 'no result from local component' });

      await expect(shelly.pulseDevice('puerta')).rejects.toThrow('Shelly API error');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
