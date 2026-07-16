import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getShellyStatus, markStale } from './shellyLocalStatus.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '../../config/shelly.json');

let cachedConfig = null;

let lastShellyRequestTime = 0;
const MIN_SPACING_MS = 1200;

async function shellyThrottle() {
  const now = Date.now();
  const wait = Math.max(0, MIN_SPACING_MS - (now - lastShellyRequestTime));
  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  lastShellyRequestTime = Date.now();
}

let statusCache = null;
let statusCacheTime = 0;
const STATUS_CACHE_TTL = 8000;

export function invalidateStatusCache() {
  statusCache = null;
  statusCacheTime = 0;
}

export function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      'Shelly config file not found. Please create backend/config/shelly.json ' +
      'from backend/config/shelly.example.json'
    );
  }

  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  let config;

  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON in backend/config/shelly.json');
  }

  if (!config.server || !config.apiKey || !Array.isArray(config.devices)) {
    throw new Error(
      'Invalid shelly config: "server", "apiKey", and "devices" (array) are required'
    );
  }

  cachedConfig = config;
  return config;
}

export function getDevices() {
  const config = loadConfig();
  return config.devices.map(d => ({
    id: d.id,
    name: d.name,
    room: d.room || '',
    channel: d.channel ?? 0,
    group: d.group || 'lights',
  }));
}

export function getGroups() {
  const config = loadConfig();
  return config.groups || [];
}

export function getDeviceById(deviceId) {
  const config = loadConfig();
  const device = config.devices.find(d => d.id === deviceId) || null;
  if (!device) return null;
  return {
    ...device,
    shellyId: device.shellyId || device.id,
    channel: device.channel ?? 0,
  };
}

export async function fetchDeviceStatus(deviceId) {
  const config = loadConfig();
  const device = config.devices.find(d => d.id === deviceId);
  if (!device) {
    return null;
  }

  const shellyId = device.shellyId || device.id;
  const channel = device.channel ?? 0;
  const url = `${config.server}/device/status?id=${encodeURIComponent(shellyId)}&auth_key=${encodeURIComponent(config.apiKey)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Shelly status error for ${deviceId}: HTTP ${response.status}`);
      return { on: null, online: false };
    }

    const data = await response.json();

    if (!data.isok) {
      console.error(`Shelly status error for ${deviceId}:`, data);
      return { on: null, online: false };
    }

    const online = data.data?.online ?? false;
    if (!online) {
      return { on: null, online: false };
    }

    const deviceStatus = data.data?.device_status;

    let isOn = null;
    if (deviceStatus?.relays?.[channel]) {
      isOn = deviceStatus.relays[channel].ison ?? null;
    } else if (deviceStatus?.['switch:' + channel]) {
      isOn = deviceStatus['switch:' + channel].output ?? null;
    }

    return { on: isOn, online: true };
  } catch (error) {
    console.error(`Shelly status fetch failed for ${deviceId}:`, error.message);
    return { on: null, online: false };
  }
}

export async function fetchAllStatuses() {
  const now = Date.now();
  if (statusCache && statusCacheTime + STATUS_CACHE_TTL > now) {
    return statusCache;
  }

  const promise = _doFetchAllStatuses();
  statusCache = promise;
  statusCacheTime = now;

  promise.catch(() => {
    statusCache = null;
    statusCacheTime = 0;
  });

  return promise;
}

async function _doFetchAllStatuses() {
  const devices = getDevices();
  const config = loadConfig();

  const uniqueShellyIds = new Map();
  for (const raw of config.devices) {
    const sid = raw.shellyId || raw.id;
    if (!uniqueShellyIds.has(sid)) {
      uniqueShellyIds.set(sid, true);
    }
  }

  const statusMap = new Map();
  const statusPromises = [...uniqueShellyIds.keys()].map(async (sid) => {
    const local = getShellyStatus(sid);
    if (local) {
      statusMap.set(sid, local);
    } else {
      const status = await fetchStatusForShellyId(sid);
      statusMap.set(sid, status);
    }
  });

  await Promise.allSettled(statusPromises);

  return devices.map(device => {
    const sid = config.devices.find(d => d.id === device.id)?.shellyId || device.id;
    const status = statusMap.get(sid);
    if (status) {
      const isOn = status.relays?.[device.channel]?.on ?? null;
      return { ...device, on: isOn, online: status.online };
    }
    return { ...device, on: null, online: false };
  });
}

async function fetchStatusForShellyId(shellyId) {
  const config = loadConfig();
  const url = `${config.server}/device/status?id=${encodeURIComponent(shellyId)}&auth_key=${encodeURIComponent(config.apiKey)}`;

  await shellyThrottle();

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status >= 500 && attempt < 2) {
          console.error(`Shelly status error for ${shellyId}: HTTP ${response.status} (attempt ${attempt + 1})`);
          continue;
        }
        console.error(`Shelly status error for ${shellyId}: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data.isok) {
        console.error(`Shelly status error for ${shellyId}:`, data);
        return null;
      }

      const online = data.data?.online ?? false;
      if (!online) {
        console.warn(`Shelly device ${shellyId} reported offline`);
        return { online: false, relays: [] };
      }

      const deviceStatus = data.data?.device_status;
      const relays = extractRelays(deviceStatus);

      return { online: true, relays };
    } catch (error) {
      console.error(`Shelly status fetch failed for ${shellyId} (attempt ${attempt + 1}):`, error.message);
    }
  }

  console.error(`Shelly status fetch failed for ${shellyId} after 3 attempts`);
  return null;
}

export async function getRelayStatus(shellyId, channel) {
  const status = await fetchStatusForShellyId(shellyId);
  if (!status || !status.online) return null;
  const relay = status.relays?.[channel];
  if (!relay) return null;
  return relay.on;
}

function extractRelays(deviceStatus) {
  if (!deviceStatus) return [];

  if (Array.isArray(deviceStatus.relays)) {
    return deviceStatus.relays.map(r => ({ on: r.ison ?? null }));
  }

  const switches = [];
  let idx = 0;
  while (deviceStatus['switch:' + idx] !== undefined) {
    switches.push({ on: deviceStatus['switch:' + idx].output ?? null });
    idx++;
  }

  return switches;
}

export async function toggleDevice(deviceId) {
  invalidateStatusCache();
  const config = loadConfig();
  const device = config.devices.find(d => d.id === deviceId);
  if (!device) {
    throw new Error(`Device not found: ${deviceId}`);
  }

  const shellyId = device.shellyId || device.id;
  markStale(shellyId);
  const channel = device.channel ?? 0;
  const url = `${config.server}/device/relay/control`;
  const body = new URLSearchParams({
    id: shellyId,
    channel: String(channel),
    turn: 'toggle',
    auth_key: config.apiKey,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    console.error(`Shelly toggle error for ${deviceId}: HTTP ${response.status}`);
    throw new Error(`Shelly API error: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.isok) {
    console.error(`Shelly toggle error for ${deviceId}:`, data);
    throw new Error('Shelly API returned unsuccessful response');
  }

  const targetOn = await pollForState(deviceId);
  return { on: targetOn };
}

export async function turnDeviceOn(deviceId) {
  invalidateStatusCache();
  const config = loadConfig();
  const device = config.devices.find(d => d.id === deviceId);
  if (!device) {
    throw new Error(`Device not found: ${deviceId}`);
  }

  const shellyId = device.shellyId || device.id;
  markStale(shellyId);
  const channel = device.channel ?? 0;
  const url = `${config.server}/device/relay/control`;
  const body = new URLSearchParams({
    id: shellyId,
    channel: String(channel),
    turn: 'on',
    auth_key: config.apiKey,
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await response.json();

      if (response.ok && data.isok === true) {
        const status = await fetchDeviceStatus(deviceId);
        if (status.online && status.on !== true) {
          console.warn(`Shelly turn on verification failed for ${deviceId} (attempt ${attempt + 1}), retrying`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return { on: true };
      }

      if (data?.errors?.max_req) {
        console.warn(`Shelly turn on rate limit for ${deviceId} (attempt ${attempt + 1}), waiting before retry`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      console.error(`Shelly turn on error for ${deviceId} (attempt ${attempt + 1}):`, JSON.stringify(data));
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw new Error(`Shelly API error: ${JSON.stringify(data)}`);
    } catch (error) {
      if (error.message?.startsWith('Shelly API error:')) throw error;
      console.error(`Shelly turn on error for ${deviceId} (attempt ${attempt + 1}):`, error.message);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw new Error(`Shelly turn on failed for ${deviceId} after 3 attempts`);
}

export async function turnDeviceOff(deviceId) {
  invalidateStatusCache();
  const config = loadConfig();
  const device = config.devices.find(d => d.id === deviceId);
  if (!device) {
    throw new Error(`Device not found: ${deviceId}`);
  }

  const shellyId = device.shellyId || device.id;
  markStale(shellyId);
  const channel = device.channel ?? 0;
  const url = `${config.server}/device/relay/control`;
  const body = new URLSearchParams({
    id: shellyId,
    channel: String(channel),
    turn: 'off',
    auth_key: config.apiKey,
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await response.json();

      if (response.ok && data.isok === true) {
        const status = await fetchDeviceStatus(deviceId);
        if (status.online && status.on !== false) {
          console.warn(`Shelly turn off verification failed for ${deviceId} (attempt ${attempt + 1}), retrying`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return { on: false };
      }

      if (data?.errors?.max_req) {
        console.warn(`Shelly turn off rate limit for ${deviceId} (attempt ${attempt + 1}), waiting before retry`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      console.error(`Shelly turn off error for ${deviceId} (attempt ${attempt + 1}):`, JSON.stringify(data));
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw new Error(`Shelly API error: ${JSON.stringify(data)}`);
    } catch (error) {
      if (error.message?.startsWith('Shelly API error:')) throw error;
      console.error(`Shelly turn off error for ${deviceId} (attempt ${attempt + 1}):`, error.message);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw new Error(`Shelly turn off failed for ${deviceId} after 3 attempts`);
}

async function pollForState(deviceId) {
  const maxAttempts = 5;
  const interval = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, interval));

    const status = await fetchDeviceStatus(deviceId);
    if (status.online) {
      return status.on;
    }
  }

  const finalStatus = await fetchDeviceStatus(deviceId);
  return finalStatus.on;
}
