import 'dotenv/config';
import ModbusRTU from 'modbus-serial';

const HOST     = process.env.MODBUS_HOST || '192.168.1.100';
const PORT     = parseInt(process.env.MODBUS_PORT || '502', 10);
const BACKEND  = (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/+$/, '');
const API_KEY  = process.env.API_KEY || '';
const INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000', 10);
const TIMEOUT  = 4000;

// ── Decoding helpers ────────────────────────────────────────────

function uint16(raw, scale = 1) { return raw[0] * scale; }
function int16(raw, scale = 1) {
  let v = raw[0];
  if (v >= 0x8000) v -= 0x10000;
  return v * scale;
}
function uint32(raw, scale = 1) { return ((raw[0] * 65536) + raw[1]) * scale; }
function int32(raw, scale = 1) {
  const u = uint32(raw);
  return u >= 0x80000000 ? (u - 0x100000000) * scale : u * scale;
}

function parseString(registers) {
  const buf = Buffer.alloc(registers.length * 2);
  for (let i = 0; i < registers.length; i++) buf.writeUInt16BE(registers[i], i * 2);
  return buf.toString('ascii').replace(/\0/g, '').trim();
}

// ── Optimised polling blocks (compact, minimal reads) ───────────

const OP_BLOCKS = [
  { start: 32000, count: 90 },
];

const MASTER_BLOCKS = [
  { start: 32000, count: 90 },
  { start: 37000, count: 60 },
  { start: 37060, count: 70 },
];

const SLAVE_BLOCKS = [
  { start: 32000, count: 90 },
];

// ── Register extraction from cache ──────────────────────────────

function slice(cache, addr, count) {
  for (const [start, data] of Object.entries(cache)) {
    const s = parseInt(start);
    if (addr >= s && addr + count - 1 < s + data.length)
      return data.slice(addr - s, addr - s + count);
  }
  return null;
}

async function readBlock(client, unitId, start, count) {
  try {
    client.setID(unitId);
    client.setTimeout(TIMEOUT);
    return (await client.readHoldingRegisters(start, count)).data;
  } catch (e) { return null; }
}

async function readAll(client, unitId, blocks) {
  const cache = {};
  const times = [];
  for (const b of blocks) {
    const t0 = Date.now();
    const data = await readBlock(client, unitId, b.start, b.count);
    times.push(`${b.start}:${Date.now()-t0}ms${data?'':'✗'}`);
    if (data) cache[b.start] = data;
  }
  return { cache, times };
}

// ── Decode a single reading for one inverter ────────────────────

function decodeReading(cache, hasBattery, hasMeter) {
  const r = {};

  // PV Strings (32016-32019)
  const pv1V = slice(cache, 32016, 1);
  const pv1I = slice(cache, 32017, 1);
  const pv2V = slice(cache, 32018, 1);
  const pv2I = slice(cache, 32019, 1);
  r.pv1Voltage = pv1V ? uint16(pv1V, 0.1) : null;
  r.pv1Current = pv1I ? uint16(pv1I, 0.01) : null;
  r.pv2Voltage = pv2V ? uint16(pv2V, 0.1) : null;
  r.pv2Current = pv2I ? uint16(pv2I, 0.01) : null;

  // PV power (computed)
  if (r.pv1Voltage != null && r.pv1Current != null) {
    const p1 = r.pv1Voltage * r.pv1Current;
    const p2 = (r.pv2Voltage != null && r.pv2Current != null) ? r.pv2Voltage * r.pv2Current : 0;
    r.pvPower = Math.round((p1 + p2) * 10) / 10;
  }

  // Active Power (32080-32081, int32)
  const acRaw = slice(cache, 32080, 2);
  r.activePower = acRaw ? int32(acRaw) : null;

  // Grid Voltage (32069)
  const gvRaw = slice(cache, 32069, 1);
  r.gridVoltage = gvRaw ? uint16(gvRaw, 0.1) : null;

  // Temperature (32087)
  const tmpRaw = slice(cache, 32087, 1);
  r.temperature = tmpRaw ? uint16(tmpRaw, 0.1) : null;

  // Running State (32000)
  const rsRaw = slice(cache, 32000, 1);
  r.runningState = rsRaw ? rsRaw[0] : null;

  // Meter (Master only, 37113-37114, int32)
  if (hasMeter) {
    const mRaw = slice(cache, 37113, 2);
    r.meterPower = mRaw ? int32(mRaw) : null;
  }

  // Battery (Master only, 37000-37007)
  if (hasBattery) {
    const socRaw = slice(cache, 37004, 1);
    r.battSoc = socRaw ? Math.round(uint16(socRaw, 0.1) * 10) / 10 : null;

    const bCurRaw = slice(cache, 37002, 1);
    r._battCurrentRaw = bCurRaw ? bCurRaw[0] : null;
    r.battCurrent = bCurRaw ? Math.round(int16(bCurRaw, 0.01) * 100) / 100 : null;
    if (r.battCurrent != null) r.battCurrent = -r.battCurrent;

    const bVolRaw = slice(cache, 37003, 1);
    r.battVoltage = bVolRaw ? Math.round(uint16(bVolRaw, 0.01) * 100) / 100 : null;

    if (r.battCurrent != null && r.battVoltage != null)
      r.battPower = Math.round(r.battCurrent * r.battVoltage * 2);
  }

  // Power Limit (40118)
  const plRaw = slice(cache, 40118, 1);
  r.gridPwrLimit = plRaw ? plRaw[0] : null;

  return r;
}

// ── HTTP POST to backend ────────────────────────────────────────

async function postReading(readings) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    readings,
  });

  try {
    const res = await fetch(`${BACKEND}/api/ingestion/inverter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: payload,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${text}`);
    }

    const json = await res.json();
    console.log(`[${new Date().toISOString()}] Stored ${json.stored} readings`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] POST failed: ${err.message}`);
  }
}

// ── Identity (once at startup) ──────────────────────────────────

async function readIdentity(client, unitId) {
  const { cache } = await readAll(client, unitId, [{ start: 30000, count: 30 }]);
  const modelRaw = slice(cache, 30000, 15);
  const snRaw = slice(cache, 30015, 10);
  return {
    model: modelRaw ? parseString(modelRaw) : 'unknown',
    serial: snRaw ? parseString(snRaw) : 'unknown',
  };
}

// ── Main loop ───────────────────────────────────────────────────

async function main() {
  if (!API_KEY || API_KEY === 'your-api-key') {
    console.error('ERROR: API_KEY is not configured. Set it in .env');
    process.exit(1);
  }

  console.log('Connecting to ModBus...');
  let client;
  try {
    client = new ModbusRTU({ timeout: TIMEOUT });
    console.log('TCP connecting...');
    await Promise.race([
      client.connectTCP(HOST, { port: PORT }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TCP connect timeout after 10s')), 10000)),
    ]);
    console.log('TCP connected.');
  } catch (err) {
    console.error(`Connection failed: ${err.message}`);
    process.exit(1);
  }

  // Read identity once
  const masterId = await readIdentity(client, 1);
  const slaveId = await readIdentity(client, 2);
  console.log(`Master: ${masterId.model} [${masterId.serial}]`);
  console.log(`Slave:  ${slaveId.model} [${slaveId.serial}]`);

  // Warm-up
  try { await readBlock(client, 1, 30070, 1); } catch (e) {}
  try { await readBlock(client, 2, 30070, 1); } catch (e) {}

  console.log(`Polling every ${INTERVAL}ms → ${BACKEND}/api/ingestion/inverter`);

  let running = true;
  process.on('SIGINT', () => { running = false; });
  process.on('SIGTERM', () => { running = false; });

  while (running) {
    const t0 = Date.now();
    try {
      const { cache: masterCache, times: masterTimes } = await readAll(client, 1, MASTER_BLOCKS);
      const t1 = Date.now();
      const masterReading = decodeReading(masterCache, true, true);
      masterReading.inverterId = 'master';

      // Warm-up slave: first read after setID(2) times out on this firmware
      await readBlock(client, 2, 30070, 1);

      const { cache: slaveCache, times: slaveTimes } = await readAll(client, 2, SLAVE_BLOCKS);
      const t2 = Date.now();
      const slaveReading = decodeReading(slaveCache, false, false);
      slaveReading.inverterId = 'slave';

      const pvOk = masterReading.pv1Voltage != null && slaveReading.pv1Voltage != null;
      const battOk = masterReading.battPower != null;
      const meterOk = masterReading.meterPower != null;
      // Sanity: solar + battery(discharge) + grid(import) should be >= 0
      const solarProd = (masterReading.pvPower || 0) + (slaveReading.pvPower || 0);
      const balOk = (solarProd + (masterReading.battPower || 0) - (masterReading.meterPower || 0)) >= 0;
      const allOk = pvOk && battOk && meterOk && balOk;
      if (allOk) {
        await postReading([masterReading, slaveReading]);
        const t3 = Date.now();
        const bRaw = masterReading._battCurrentRaw ?? '?';
        process.stderr.write(`  [${new Date().toISOString()}] m[${masterTimes.join(' ')}] (${t1-t0}ms) s[${slaveTimes.join(' ')}] (${t2-t1}ms) post:${t3-t2}ms bRaw:${bRaw}\n`);
      } else {
        const missing = [!pvOk&&'PV',!battOk&&'Batt',!meterOk&&'Meter',!balOk&&'Balance'].filter(Boolean).join(',');
        process.stderr.write(`  [${new Date().toISOString()}] skipped (${missing || 'ok?'}) (${Date.now()-t0}ms)\n`);
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Cycle error: ${err.message}`);
    }

    if (running) await new Promise(r => setTimeout(r, INTERVAL));
  }

  client.close();
  console.log('\nStopped.');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
