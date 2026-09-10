import { readFileSync } from 'fs';
import 'dotenv/config';

const CONFIG_PATH = process.env.SHELLY_CONFIG || './shelly.json';
const POLL_INTERVAL = parseInt(process.env.SHELLY_POLL_INTERVAL_MS || '10000', 10);
const BACKEND = (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/+$/, '');
const API_KEY = process.env.API_KEY || '';
const BACKEND_PATH = process.env.SHELLY_BACKEND_PATH || '/api/ingestion/device';
const FLOW_BACKEND_PATH = process.env.SHELLY_FLOW_BACKEND_PATH || '/api/ingestion/flow';
// Flow counters change slowly compared to relay state, so they can be polled
// on a multiple of the relay tick (1 = every tick).
const FLOW_EVERY_N_TICKS = Math.max(1, parseInt(process.env.SHELLY_FLOW_POLL_EVERY_N_TICKS || '3', 10));

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
  const { shellyId, ip } = device;
  const channels = device.channels || [];
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

// Counter input of a Shelly Plus Uni (Gen2): input:2 configured as type "count".
// Returns the raw payload — calibration (pulses per litre) lives in the
// backend config, so the device firmware never decides what a litre is.
async function fetchInputStatus(ip, input, timeoutMs) {
  try {
    const res = await fetch(`http://${ip}/rpc/Input.GetStatus?id=${input}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || typeof data !== 'object') throw new Error('unexpected rpc shape');
    return data;
  } catch {
    return null;
  }
}

async function pollSensors(device, timeoutMs) {
  const { shellyId, ip } = device;
  const results = [];

  for (const input of device.inputs || []) {
    const id = input.id ?? 2;
    const status = await fetchInputStatus(ip, id, timeoutMs);

    if (status === null) {
      // Unreachable: report it explicitly so the backend can record
      // "sin conexión" instead of a silent gap it cannot interpret.
      results.push({ shellyId, input: id, online: false });
      continue;
    }

    results.push({
      shellyId,
      input: id,
      online: true,
      counts: status.counts ?? null,
      freq: typeof status.freq === 'number' ? status.freq : null,
    });
  }

  return results;
}

async function postToBackend(payload, path = BACKEND_PATH, label = 'device') {
  const url = `${BACKEND}${path}`;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const wait = Math.min(1000 * Math.pow(2, attempt), 30000);
      console.warn(`Shelly forwarder POST ${path} retry ${attempt + 1}/${4} in ${wait}ms`);
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
        const count = (payload.devices || payload.sensors || []).length;
        console.log(`Shelly forwarder: pushed ${count} ${label}(s)`);
        return;
      }

      console.error(`Shelly forwarder POST ${path} HTTP ${res.status} (attempt ${attempt + 1}/${4})`);
    } catch (err) {
      console.error(`Shelly forwarder POST failed (attempt ${attempt + 1}/${4}):`, err.message);
    }
  }

  console.error(`Shelly forwarder POST ${path} failed after 4 attempts`);
}

let tickCount = 0;

async function tick() {
  const cfg = loadConfig();
  const devices = cfg.devices;
  const timeoutMs = cfg.requestTimeoutMs || 3000;
  const timestamp = new Date().toISOString();
  const pollSensorsNow = tickCount % FLOW_EVERY_N_TICKS === 0;
  tickCount++;

  const results = [];
  const sensorResults = [];

  for (const device of devices) {
    if ((device.channels || []).length > 0) {
      results.push(await pollDevice(device, timeoutMs));
    }
    if (pollSensorsNow && (device.inputs || []).length > 0) {
      sensorResults.push(...await pollSensors(device, timeoutMs));
    }
  }

  const onlineCount = results.filter(d => d.online).length;
  console.log(`Shelly forwarder: ${onlineCount}/${results.length} online`);

  if (results.length > 0) {
    await postToBackend({ timestamp, devices: results });
  }

  if (sensorResults.length > 0) {
    const sensorsOnline = sensorResults.filter(s => s.online).length;
    console.log(`Shelly forwarder: ${sensorsOnline}/${sensorResults.length} sensor input(s) online`);
    await postToBackend({ timestamp, sensors: sensorResults }, FLOW_BACKEND_PATH, 'sensor');
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
  const cfg = loadConfig();
  const sensorInputs = cfg.devices.reduce((n, d) => n + (d.inputs || []).length, 0);
  console.log(
    `Shelly forwarder starting — ${cfg.devices.length} device(s), ${sensorInputs} sensor input(s), ` +
    `poll every ${POLL_INTERVAL}ms (flow every ${FLOW_EVERY_N_TICKS} tick(s))`
  );
  tick();

  interval = setInterval(tick, POLL_INTERVAL);

  process.on('SIGINT', gracefullyStop);
  process.on('SIGTERM', gracefullyStop);
}

main().catch(err => {
  console.error('Shelly forwarder fatal:', err);
  process.exit(1);
});