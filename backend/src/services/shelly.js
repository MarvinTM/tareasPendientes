import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '../../config/shelly.json');

let cachedConfig = null;

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
  }));
}

export function getDeviceById(deviceId) {
  const config = loadConfig();
  return config.devices.find(d => d.id === deviceId) || null;
}

export async function fetchDeviceStatus(deviceId) {
  const config = loadConfig();
  const device = config.devices.find(d => d.id === deviceId);
  if (!device) {
    return null;
  }

  const url = `${config.server}/device/status?id=${encodeURIComponent(deviceId)}&auth_key=${encodeURIComponent(config.apiKey)}`;

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

    const isOn = data.data?.device_status?.relays?.[0]?.ison ?? null;
    return { on: isOn, online: true };
  } catch (error) {
    console.error(`Shelly status fetch failed for ${deviceId}:`, error.message);
    return { on: null, online: false };
  }
}

export async function fetchAllStatuses() {
  const devices = getDevices();
  const results = await Promise.allSettled(
    devices.map(async (device) => {
      const status = await fetchDeviceStatus(device.id);
      return {
        ...device,
        ...status,
      };
    })
  );

  return results.map(r =>
    r.status === 'fulfilled'
      ? r.value
      : { on: null, online: false }
  );
}

export async function toggleDevice(deviceId) {
  const config = loadConfig();
  const device = config.devices.find(d => d.id === deviceId);
  if (!device) {
    throw new Error(`Device not found: ${deviceId}`);
  }

  const url = `${config.server}/device/relay/control`;
  const body = new URLSearchParams({
    id: deviceId,
    channel: '0',
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
