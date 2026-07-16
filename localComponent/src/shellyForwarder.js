import { readFileSync } from 'fs';
import 'dotenv/config';

const CONFIG_PATH = process.env.SHELLY_CONFIG || './shelly.json';
const POLL_INTERVAL = parseInt(process.env.SHELLY_POLL_INTERVAL_MS || '10000', 10);
const BACKEND = (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/+$/, '');
const API_KEY = process.env.API_KEY || '';
const BACKEND_PATH = process.env.SHELLY_BACKEND_PATH || '/api/ingestion/device';

let config = null;

function loadConfig() {
  if (config) return config;
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  config = JSON.parse(raw);
  if (!Array.isArray(config.devices)) {
    throw new Error('shelly.json: "devices" must be an array');
  }
  return config;
}

async function fetchShellyStatus(ip, channel, timeoutMs) {
  try {
    const res = await fetch(`http://${ip}/rpc/Switch.GetStatus?id=${channel}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && typeof data.output !== 'undefined') {
      return { on: data.output };
    }
    throw new Error('unexpected rpc shape, trying Gen1 fallback');
  } catch {
    try {
      const res = await fetch(`http://${ip}/relay/${channel}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && typeof data.ison !== 'undefined') {
        return { on: data.ison };
      }
      throw new Error('unexpected relay shape');
    } catch {
      return null;
    }
  }
}

async function pollDevice(device, timeoutMs) {
  const { shellyId, ip, channels } = device;
  const relays = [];
  let online = false;

  for (const ch of channels) {
    const result = await fetchShellyStatus(ip, ch, timeoutMs);
    if (result !== null) {
      online = true;
      relays[ch] = { on: result.on };
    } else {
      relays[ch] = { on: null };
    }
  }

  for (let i = 0; i < channels.length; i++) {
    if (!relays[i]) relays[i] = { on: null };
  }

  return { shellyId, online, relays };
}

async function postToBackend(payload) {
  const url = `${BACKEND}${BACKEND_PATH}`;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const wait = Math.min(1000 * Math.pow(2, attempt), 30000);
      console.warn(`Shelly forwarder POST retry ${attempt + 1}/${4} in ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        console.log(`Shelly forwarder: pushed ${payload.devices.length} device(s)`);
        return;
      }

      console.error(`Shelly forwarder POST HTTP ${res.status} (attempt ${attempt + 1}/${4})`);
    } catch (err) {
      console.error(`Shelly forwarder POST failed (attempt ${attempt + 1}/${4}):`, err.message);
    }
  }

  console.error('Shelly forwarder POST failed after 4 attempts');
}

async function tick() {
  const cfg = loadConfig();
  const devices = cfg.devices;
  const timeoutMs = cfg.requestTimeoutMs || 3000;
  const timestamp = new Date().toISOString();

  const results = [];
  for (const device of devices) {
    const result = await pollDevice(device, timeoutMs);
    results.push(result);
    for (const r of results[results.length - 1].relays) {
      const onStr = r.on !== null ? String(r.on) : '?';
    }
  }

  const onlineCount = results.filter(d => d.online).length;
  console.log(`Shelly forwarder: ${onlineCount}/${results.length} online`);

  if (results.length > 0) {
    await postToBackend({ timestamp, devices: results });
  }
}

let interval = null;
let shutdown = false;

function gracefullyStop() {
  if (shutdown) return;
  shutdown = true;
  console.log('Shelly forwarder shutting down');
  if (interval) clearInterval(interval);
  process.exit(0);
}

async function main() {
  console.log(`Shelly forwarder starting — ${loadConfig().devices.length} device(s), poll every ${POLL_INTERVAL}ms`);
  tick();

  interval = setInterval(tick, POLL_INTERVAL);

  process.on('SIGINT', gracefullyStop);
  process.on('SIGTERM', gracefullyStop);
}

main().catch(err => {
  console.error('Shelly forwarder fatal:', err);
  process.exit(1);
});