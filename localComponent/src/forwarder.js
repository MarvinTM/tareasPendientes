import 'dotenv/config';

const POLLER_URL   = (process.env.POLLER_URL   || 'http://127.0.0.1:8765').replace(/\/+$/, '');
const BACKEND      = (process.env.BACKEND_URL  || 'http://localhost:3001').replace(/\/+$/, '');
const API_KEY      = process.env.API_KEY || '';
const INTERVAL     = parseInt(process.env.POLL_INTERVAL || '5000', 10);
const MAX_AGE_MS   = parseInt(process.env.MAX_AGE_MS || '60000', 10);
const CONCURRENCY  = parseInt(process.env.POST_WORKERS || '1', 10);

// ── Plausibility validation ──────────────────────────────────────
// A "successful" Modbus read can still return a well-formed frame whose
// payload bytes are 0x0000 (or a stale/garbage value). Decode produces a
// real number and the poller stores it as fresh, so without validation the
// bad value flows straight into the backend and shows up as "battery 0%"
// or "grid export 0 W" in the history. These knobs null-out implausible
// fresh values so they render as gaps / read errors downstream instead of
// corrupting the historical data. All are overridable via env so they can
// be tuned without a redeploy of code.
const BOUNDS = {
  pvVoltage:      { min: parseFloat(process.env.BOUND_PV_VOLT_MIN     || '0'),    max: parseFloat(process.env.BOUND_PV_VOLT_MAX     || '1000') },
  gridVoltage:    { min: parseFloat(process.env.BOUND_GRID_VOLT_MIN   || '150'),  max: parseFloat(process.env.BOUND_GRID_VOLT_MAX   || '300') },
  temperature:    { min: parseFloat(process.env.BOUND_TEMP_MIN        || '-20'),  max: parseFloat(process.env.BOUND_TEMP_MAX        || '90') },
  battSoc:        { min: parseFloat(process.env.BOUND_BATT_SOC_MIN    || '0'),    max: parseFloat(process.env.BOUND_BATT_SOC_MAX    || '100') },
  battVoltage:    { min: parseFloat(process.env.BOUND_BATT_VOLT_MIN  || '0'),    max: parseFloat(process.env.BOUND_BATT_VOLT_MAX  || '1000') },
  activePower:    { min: parseFloat(process.env.BOUND_ACTIVE_PWR_MIN  || '-50000'), max: parseFloat(process.env.BOUND_ACTIVE_PWR_MAX || '50000') },
  meterPower:     { min: parseFloat(process.env.BOUND_METER_PWR_MIN   || '-50000'), max: parseFloat(process.env.BOUND_METER_PWR_MAX  || '50000') },
};
// Voltage (V) above which a battery is physically present; below this the
// battery rack is offline and SOC/current readings are meaningless.
const BATT_PRESENT_VOLTAGE = parseFloat(process.env.BATT_PRESENT_VOLTAGE || '300');
// If |meterPower| is below this deadband while the inverter is clearly
// flowing significant power, the "0 W" meter reading is treated as a
// suspect/failed read and nulled out (catches "grid export 0 when ~1500").
const METER_ZERO_DEADBAND  = parseFloat(process.env.METER_ZERO_DEADBAND  || '10');
const METER_FLOW_THRESHOLD = parseFloat(process.env.METER_FLOW_THRESHOLD || '200');

let suspectCount = 0;

// Battery sign/multiplier shaping. These default to the LEGACY ingest.js
// conventions so the backend payload (and the frontend /today energy-balance
// chart) stays byte-for-byte compatible during the parallel-run + A/B compare
// phase. Once cutover is confident, validate the frontend math (houseConsumption
// = solar + batt - meter) and flip these to the physically-correct values:
//   BATTERY_POWER_MULTIPLIER=1.0  (the legacy "*2" is undocumented; likely a
//     per-stack count for a 2-module LUNA2000 — confirm against your hardware)
//   BATTERY_CURRENT_NEGATE=false (Huawei native is -charge/+discharge, which is
//     the saner convention once the multiplier is settled)
const BATTERY_POWER_MULTIPLIER = parseFloat(process.env.BATTERY_POWER_MULTIPLIER || '2.0');
const BATTERY_CURRENT_NEGATE   = process.env.BATTERY_CURRENT_NEGATE !== 'false';

const UNITS = ['master', 'slave'];

// Returns false if a reading is clearly a warm-up artifact (all values null
// or zero with no running state). This prevents the "all zeros" entries that
// appear during the first few cycles after a poller restart.
function hasRealData(payload) {
  if (payload.runningState == null) return false;
  const numericFields = [
    'pv1Voltage', 'pv1Current', 'pv2Voltage', 'pv2Current',
    'activePower', 'gridVoltage', 'meterPower', 'battSoc',
    'battCurrent', 'battVoltage', 'battPower', 'temperature',
  ];
  const hasNonNull = numericFields.some(f => payload[f] != null);
  const hasNonZero = numericFields.some(f => payload[f] != null && payload[f] !== 0);
  return hasNonNull && hasNonZero;
}

function fresh(field) {
  if (!field) return false;
  return field.ageMs <= MAX_AGE_MS;
}

function val(field) {
  return field ? field.v : null;
}

function age(field) {
  return field ? field.ageMs : Infinity;
}

// Null-out a fresh value if it violates physical bounds. Returns null for
// implausible values so they flow downstream as "missing" (gap / read error)
// rather than as a corrupt 0.
function withinBounds(name, v) {
  if (v == null || Number.isNaN(v)) return null;
  const b = BOUNDS[name];
  if (!b) return v;
  if (v < b.min || v > b.max) {
    suspectCount++;
    process.stderr.write(`  [${new Date().toISOString()}] suspect ${name}=${v} outside [${b.min}, ${b.max}] → null\n`);
    return null;
  }
  return v;
}

// Build the per-inverter payload matching backend POST /api/ingestion/inverter.
// Stale fields (ageMs > MAX_AGE_MS) become null rather than discarding the
// whole reading — this replaces the legacy "skip entire cycle on any partial
// failure" behaviour and is the single biggest data-availability improvement.
function buildPayload(unitSnap) {
  const f = unitSnap.fields || {};

  // Each field: stay null if stale, otherwise apply bounds validation so a
  // fresh-but-implausible value (the "battery 0% when full" / "meter 0 when
  // exporting 1500 W" corruption path) is nullified rather than stored.
  const pv1V = withinBounds('pvVoltage', fresh(f.pv1Voltage) ? val(f.pv1Voltage) : null);
  const pv1I = fresh(f.pv1Current) ? val(f.pv1Current) : null;
  const pv2V = withinBounds('pvVoltage', fresh(f.pv2Voltage) ? val(f.pv2Voltage) : null);
  const pv2I = fresh(f.pv2Current) ? val(f.pv2Current) : null;

  let pvPower = null;
  if (pv1V != null && pv1I != null) {
    const p1 = pv1V * pv1I;
    const p2 = (pv2V != null && pv2I != null) ? pv2V * pv2I : 0;
    pvPower = Math.round((p1 + p2) * 10) / 10;
  }

  let activePower = withinBounds('activePower', fresh(f.activePower) ? val(f.activePower) : null);
  const gridVoltage = withinBounds('gridVoltage', fresh(f.gridVoltage) ? val(f.gridVoltage) : null);
  const temperature = withinBounds('temperature', fresh(f.temperature) ? val(f.temperature) : null);
  const runningState = fresh(f.runningState) ? val(f.runningState) : null;

  let meterPower = withinBounds('meterPower', (f.meterPower && fresh(f.meterPower)) ? val(f.meterPower) : null);
  // Cross-field: "meter claims 0 while energy is clearly flowing" → the
  // meter read is almost certainly a failed/stale block, not a real 0 W.
  if (meterPower != null && Math.abs(meterPower) < METER_ZERO_DEADBAND) {
    const flow = Math.abs(activePower || 0) > METER_FLOW_THRESHOLD
              || (pvPower != null && pvPower > METER_FLOW_THRESHOLD);
    if (flow) {
      suspectCount++;
      process.stderr.write(`  [${new Date().toISOString()}] suspect meterPower=${meterPower} while flow > ${METER_FLOW_THRESHOLD}W → null\n`);
      meterPower = null;
    }
  }

  let battCurrentRaw = fresh(f.battCurrent) ? val(f.battCurrent) : null;
  let battCurrent = battCurrentRaw;
  if (battCurrent != null && BATTERY_CURRENT_NEGATE) battCurrent = Math.round(battCurrent * 100) / 100 * -1;
  const battVoltage = withinBounds('battVoltage', fresh(f.battVoltage) ? val(f.battVoltage) : null);
  let battSoc = withinBounds('battSoc', fresh(f.battSoc) ? val(f.battSoc) : null);
  // Cross-field: "battery present (voltage healthy) but SOC claims 0" → the
  // SOC read is suspect, not a real empty battery. Null SOC and the derived
  // battery current/power so they show as gaps, not a "0%" spike.
  if (battSoc != null && battSoc <= 0 && battVoltage != null && battVoltage > BATT_PRESENT_VOLTAGE) {
    suspectCount++;
    process.stderr.write(`  [${new Date().toISOString()}] suspect battSoc=${battSoc} but battVoltage=${battVoltage} > ${BATT_PRESENT_VOLTAGE}V → null SOC/current/power\n`);
    battSoc = null;
    battCurrent = null;
  }

  let battPower = null;
  if (battCurrent != null && battVoltage != null) {
    battPower = Math.round(battCurrent * battVoltage * BATTERY_POWER_MULTIPLIER);
  }

  const gridPwrLimit = fresh(f.gridPwrLimit) ? val(f.gridPwrLimit) : null;

  return {
    inverterId:  unitSnap.inverterId,
    pv1Voltage: pv1V, pv1Current: pv1I, pv2Voltage: pv2V, pv2Current: pv2I, pvPower,
    activePower, gridVoltage, meterPower,
    battSoc,     battCurrent, battVoltage, battPower,
    temperature, gridPwrLimit, runningState,
  };
}

let postRetry = 0;

async function postReadings(readings, snapTs) {
  const payload = JSON.stringify({ timestamp: snapTs, readings });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${BACKEND}/api/ingestion/inverter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: payload,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${text}`);
      }
      const json = await res.json();
      postRetry = 0;
      process.stderr.write(`  [${new Date().toISOString()}] stored ${json.stored} readings\n`,);
      return;
    } catch (err) {
      postRetry++;
      const backoff = Math.min(postRetry * 2000, 30000);
      console.error(`[${new Date().toISOString()}] POST failed (attempt ${attempt+1}, next in ${backoff}ms): ${err.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, backoff));
    }
  }
}

let running = true;
process.on('SIGINT',  () => { running = false; });
process.on('SIGTERM', () => { running = false; });

async function main() {
  if (!API_KEY || API_KEY === 'your-api-key') {
    console.error('ERROR: API_KEY is not configured. Set it in .env');
    process.exit(1);
  }
  if (!POLLER_URL) {
    console.error('ERROR: POLLER_URL is not configured.');
    process.exit(1);
  }

  console.log(`Forwarder → ${POLLER_URL}/snapshot every ${INTERVAL}ms → ${BACKEND}/api/ingestion/inverter`);
  console.log(`maxAge=${MAX_AGE_MS}ms  batteryMult=${BATTERY_POWER_MULTIPLIER}  negateBattCurrent=${BATTERY_CURRENT_NEGATE}`);
  console.log(`plausibility: bounds=${Object.keys(BOUNDS).join(',')}  battPresentV=${BATT_PRESENT_VOLTAGE}  meterDeadband=${METER_ZERO_DEADBAND}W  meterFlow=${METER_FLOW_THRESHOLD}W`);

  let snapDown = 0;
  while (running) {
    let snap;
    try {
      const res = await fetch(`${POLLER_URL}/snapshot`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      snap = await res.json();
      snapDown = 0;
    } catch (err) {
      snapDown++;
      if (snapDown <= 3 || snapDown % 20 === 0)
        console.error(`[${new Date().toISOString()}] snapshot fetch failed (${snapDown}): ${err.message}`);
      await new Promise(r => setTimeout(r, Math.min(INTERVAL, 2000 * snapDown)));
      continue;
    }

    if (!snap || !Array.isArray(snap.units) || snap.units.length === 0) {
      await new Promise(r => setTimeout(r, INTERVAL));
      continue;
    }

    // Don't post during poller warm-up: skip until the link is connected and
    // the snapshot actually has field data. During the first ~10-20s after a
    // poller restart, fields is {} and all values would be null/zero.
    if (snap.link?.state !== 'connected') {
      process.stderr.write(`  [${new Date().toISOString()}] poller not ready (link: ${snap.link?.state || '?'}), skipping...\n`);
      await new Promise(r => setTimeout(r, INTERVAL));
      continue;
    }

    const readings = [];
    for (const u of snap.units) {
      if (!UNITS.includes(u.inverterId)) continue;
      const payload = buildPayload(u);
      if (!hasRealData(payload)) continue;
      readings.push(payload);
    }
    if (readings.length) await postReadings(readings, snap.ts);

    if (running) await new Promise(r => setTimeout(r, INTERVAL));
  }

  console.log('\nStopped.');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });