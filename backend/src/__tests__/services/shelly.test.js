import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = resolve(__dirname, '../../../config/shelly.json');

const mockFetch = jest.fn();
global.fetch = mockFetch;

const validConfig = {
  server: 'https://shelly-263-eu.shelly.cloud',
  apiKey: 'test-api-key',
  devices: [
    { id: 'dev-1', name: 'Luz del salón', room: 'Salón' },
    { id: 'dev-2', shellyId: 'shelly-shared', name: 'Luz de la cocina', room: 'Cocina', channel: 0 },
    { id: 'dev-3', shellyId: 'shelly-shared', name: 'Lámpara de la cocina', room: 'Cocina', channel: 1 },
  ],
};

let originalConfigContent = null;

describe('Shelly Service', () => {
  beforeAll(() => {
    if (existsSync(CONFIG_FILE)) {
      originalConfigContent = readFileSync(CONFIG_FILE, 'utf-8');
    }
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    writeFileSync(CONFIG_FILE, JSON.stringify(validConfig));
  });

  afterAll(() => {
    if (originalConfigContent !== null) {
      writeFileSync(CONFIG_FILE, originalConfigContent);
    } else {
      try { unlinkSync(CONFIG_FILE); } catch {}
    }
  });

  describe('loadConfig', () => {
    it('loads config from file on first call', async () => {
      const { loadConfig } = await import('../../services/shelly.js');
      const result = loadConfig();
      expect(result).toEqual(validConfig);
    });

    it('caches config after first load', async () => {
      const { loadConfig } = await import('../../services/shelly.js');
      loadConfig();
      writeFileSync(CONFIG_FILE, JSON.stringify({ ...validConfig, server: 'changed' }));
      const result = loadConfig();
      expect(result.server).toBe('https://shelly-263-eu.shelly.cloud');
    });

    it('throws when required fields are missing', async () => {
      writeFileSync(CONFIG_FILE, JSON.stringify({ server: 'x' }));
      const { loadConfig } = await import('../../services/shelly.js');
      expect(() => loadConfig()).toThrow('Invalid shelly config');
    });
  });

  describe('getDevices', () => {
    it('returns device list from config', async () => {
      const { getDevices } = await import('../../services/shelly.js');
      const devices = getDevices();

      expect(devices).toHaveLength(3);
      expect(devices[0]).toEqual({ id: 'dev-1', name: 'Luz del salón', room: 'Salón', channel: 0 });
      expect(devices[1]).toEqual({ id: 'dev-2', name: 'Luz de la cocina', room: 'Cocina', channel: 0 });
      expect(devices[2]).toEqual({ id: 'dev-3', name: 'Lámpara de la cocina', room: 'Cocina', channel: 1 });
    });
    it('defaults room to empty string when missing', async () => {
      writeFileSync(CONFIG_FILE, JSON.stringify({
        ...validConfig,
        devices: [{ id: 'dev-1', name: 'Test' }],
      }));
      const { getDevices } = await import('../../services/shelly.js');
      const devices = getDevices();
      expect(devices[0].room).toBe('');
    });
  });

  describe('getDeviceById', () => {
    it('returns device with shellyId and channel resolved', async () => {
      const { getDeviceById } = await import('../../services/shelly.js');
      const device = getDeviceById('dev-1');
      expect(device.shellyId).toBe('dev-1');
      expect(device.channel).toBe(0);
    });

    it('returns shellyId from config when present', async () => {
      const { getDeviceById } = await import('../../services/shelly.js');
      const device = getDeviceById('dev-2');
      expect(device.shellyId).toBe('shelly-shared');
      expect(device.channel).toBe(0);
    });

    it('returns channel from config when present', async () => {
      const { getDeviceById } = await import('../../services/shelly.js');
      const device = getDeviceById('dev-3');
      expect(device.channel).toBe(1);
    });

    it('returns null when not found', async () => {
      const { getDeviceById } = await import('../../services/shelly.js');
      const device = getDeviceById('nonexistent');
      expect(device).toBeNull();
    });
  });

  describe('fetchDeviceStatus', () => {
    it('returns { on, online: true } on successful response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isok: true, data: { online: true, device_status: { relays: [{ ison: true }] } } }),
      });

      const { fetchDeviceStatus } = await import('../../services/shelly.js');
      const result = await fetchDeviceStatus('dev-1');

      expect(result).toEqual({ on: true, online: true });
    });

    it('returns { on: null, online: false } when device is offline', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isok: true, data: { online: false } }),
      });

      const { fetchDeviceStatus } = await import('../../services/shelly.js');
      const result = await fetchDeviceStatus('dev-1');

      expect(result).toEqual({ on: null, online: false });
    });

    it('returns { on: null, online: false } on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { fetchDeviceStatus } = await import('../../services/shelly.js');
      const result = await fetchDeviceStatus('dev-1');

      expect(result).toEqual({ on: null, online: false });
    });

    it('returns { on: null, online: false } on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const { fetchDeviceStatus } = await import('../../services/shelly.js');
      const result = await fetchDeviceStatus('dev-1');

      expect(result).toEqual({ on: null, online: false });
    });

    it('constructs correct URL with shellyId from config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isok: true, data: { online: true, device_status: { relays: [{ ison: false }] } } }),
      });

      const { fetchDeviceStatus } = await import('../../services/shelly.js');
      await fetchDeviceStatus('dev-2');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('device/status?id=shelly-shared');
      expect(calledUrl).toContain('auth_key=test-api-key');
    });

    it('reads correct channel relay for multi-channel Shelly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isok: true,
          data: {
            online: true,
            device_status: { relays: [{ ison: false }, { ison: true }] },
          },
        }),
      });

      const { fetchDeviceStatus } = await import('../../services/shelly.js');
      const result = await fetchDeviceStatus('dev-3');

      expect(result).toEqual({ on: true, online: true });
    });

    it('returns null for unknown device', async () => {
      const { fetchDeviceStatus } = await import('../../services/shelly.js');
      const result = await fetchDeviceStatus('unknown-device');
      expect(result).toBeNull();
    });
  });

  describe('fetchAllStatuses', () => {
    it('returns all devices with status', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isok: true, data: { online: true, device_status: { relays: [{ ison: true }] } } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isok: true, data: { online: true, device_status: { relays: [{ ison: false }] } } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isok: true, data: { online: true, device_status: { relays: [{ ison: true }, { ison: false }] } } }),
        });

      const { fetchAllStatuses } = await import('../../services/shelly.js');
      const results = await fetchAllStatuses();

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ id: 'dev-1', name: 'Luz del salón', room: 'Salón', channel: 0, on: true, online: true });
      expect(results[1]).toEqual({ id: 'dev-2', name: 'Luz de la cocina', room: 'Cocina', channel: 0, on: false, online: true });
      expect(results[2]).toEqual({ id: 'dev-3', name: 'Lámpara de la cocina', room: 'Cocina', channel: 1, on: false, online: true });
    });

    it('handles mixed online and offline devices', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isok: true, data: { online: true, device_status: { relays: [{ ison: true }] } } }),
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isok: true, data: { online: false } }),
        });

      const { fetchAllStatuses } = await import('../../services/shelly.js');
      const results = await fetchAllStatuses();

      expect(results).toHaveLength(3);
      expect(results[0].online).toBe(true);
      expect(results[0].on).toBe(true);
      expect(results[1].on).toBeNull();
      expect(results[1].online).toBe(false);
      expect(results[2].on).toBeNull();
      expect(results[2].online).toBe(false);
    });
  });

  describe('toggleDevice', () => {
    it('sends POST with correct form-encoded body', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ isok: true }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isok: true, data: { online: true, device_status: { relays: [{ ison: true }] } } }),
        });

      const { toggleDevice } = await import('../../services/shelly.js');
      await toggleDevice('dev-2');

      const postCall = mockFetch.mock.calls[0];
      expect(postCall[0]).toContain('device/relay/control');
      expect(postCall[1].method).toBe('POST');

      const bodyStr = postCall[1].body.toString();
      expect(bodyStr).toContain('id=shelly-shared');
      expect(bodyStr).toContain('channel=0');
      expect(bodyStr).toContain('turn=toggle');
      expect(bodyStr).toContain('auth_key=test-api-key');
    });

    it('sends correct channel for multi-channel device', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ isok: true }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isok: true, data: { online: true, device_status: { relays: [{ ison: true }, { ison: false }] } } }),
        });

      const { toggleDevice } = await import('../../services/shelly.js');
      await toggleDevice('dev-3');

      const bodyStr = mockFetch.mock.calls[0][1].body.toString();
      expect(bodyStr).toContain('id=shelly-shared');
      expect(bodyStr).toContain('channel=1');
    });

    it('polls after toggle until Shelly confirms new state', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ isok: true }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isok: true, data: { online: false } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isok: true, data: { online: true, device_status: { relays: [{ ison: false }] } } }),
        });

      const { toggleDevice } = await import('../../services/shelly.js');
      jest.useFakeTimers();

      const promise = toggleDevice('dev-1');
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ on: false });
      jest.useRealTimers();
    }, 15000);

    it('returns last known state after max polling attempts', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ isok: true }) });
      for (let i = 0; i < 7; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isok: true, data: { online: false } }),
        });
      }

      const { toggleDevice } = await import('../../services/shelly.js');
      jest.useFakeTimers();

      const promise = toggleDevice('dev-1');
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result.on).toBeNull();
      jest.useRealTimers();
    }, 15000);

    it('throws when device is not in config', async () => {
      const { toggleDevice } = await import('../../services/shelly.js');
      await expect(toggleDevice('unknown')).rejects.toThrow('Device not found');
    });

    it('throws when Shelly POST returns HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const { toggleDevice } = await import('../../services/shelly.js');
      await expect(toggleDevice('dev-1')).rejects.toThrow('Shelly API error');
    });

    it('throws when Shelly POST returns unsuccessful response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isok: false }),
      });

      const { toggleDevice } = await import('../../services/shelly.js');
      await expect(toggleDevice('dev-1')).rejects.toThrow('unsuccessful response');
    });
  });
});
