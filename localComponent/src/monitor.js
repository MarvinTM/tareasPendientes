import 'dotenv/config';
import ModbusRTU from 'modbus-serial';
import { createWriteStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const HOST = process.env.MODBUS_HOST || '192.168.1.100';
const PORT = parseInt(process.env.MODBUS_PORT || '502', 10);
const TIMEOUT = 4000;
const INTERVAL = 1000;
const RANGE_START = 32000;
const RANGE_END = 32150;
const BASE = `monitor-live-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const CSV_OUT = process.env.OUT || `${BASE}.csv`;
const REPORT_OUT = process.env.REPORT || `${BASE}.report.txt`;
const SLAVES = [1, 2];

// ── Utilities ──────────────────────────────────────────────────

function uint32BE(hi, lo) { return (hi * 65536) + lo; }
function int32BE(hi, lo) {
  const u = uint32BE(hi, lo);
  return u >= 0x80000000 ? u - 0x100000000 : u;
}
function float32ABCD(hi, lo) {
  const buf = Buffer.alloc(4);
  buf.writeUInt16BE(hi, 0);
  buf.writeUInt16BE(lo, 2);
  return buf.readFloatBE(0);
}
function float32CDAB(hi, lo) {
  const buf = Buffer.alloc(4);
  buf.writeUInt16BE(lo, 0);
  buf.writeUInt16BE(hi, 2);
  return buf.readFloatBE(0);
}
function fmtF32(v) {
  if (!isFinite(v)) return '';
  return v.toPrecision(7);
}

// ── Stats (incremental) ────────────────────────────────────────

class Stats {
  constructor() {
    this.n = 0;
    this.sum = 0;
    this._min = 65535;
    this._max = 0;
    this.set = new Set();
  }
  push(v) {
    this.n++;
    this.sum += v;
    if (v < this._min) this._min = v;
    if (v > this._max) this._max = v;
    this.set.add(v);
  }
  avg()    { return this.n ? this.sum / this.n : 0; }
  min()    { return this.n ? this._min : 0; }
  max()    { return this.n ? this._max : 0; }
  unique() { return this.set.size; }
  stddev() {
    if (this.n < 2) return 0;
    const m = this.avg();
    let sq = 0;
    for (let i = 0; i < this.n; i++) {
      // We don't store the array, just recompute from saved stats.
      // But we need the array for stddev. Store it minimally.
    }
    // Need values array for stddev — store compactly
    return 0; // placeholder, fixed below
  }
}

// ── Better: store values + compute stats once ──────────────────

function computeStats(values) {
  if (values.length === 0) return { n: 0, avg: 0, min: 0, max: 0, unique: 0, stddev: 0 };
  let sum = 0, mn = 65535, mx = 0;
  const set = new Set();
  for (const v of values) {
    sum += v;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    set.add(v);
  }
  const avg = sum / values.length;
  let sq = 0;
  for (const v of values) sq += (v - avg) ** 2;
  const stddev = values.length > 1 ? Math.sqrt(sq / (values.length - 1)) : 0;
  return { n: values.length, avg, min: mn, max: mx, unique: set.size, stddev };
}

// ── Read helper ────────────────────────────────────────────────

async function readBlock(client, unitId, start, count) {
  try {
    client.setID(unitId);
    client.setTimeout(TIMEOUT);
    const data = await Promise.race([
      client.readHoldingRegisters(start, count),
      new Promise((_, reject) => setTimeout(() => reject(new Error('external_timeout')), TIMEOUT + 2000)),
    ]);
    return data.data;
  } catch (e) { return null; }
}

// ── Generate report (fast, pure computation, no objects) ───────

function generateReport(phase1Data, phase2Data) {
  process.stderr.write('  computing stats per register...\n');

  const rows = [];
  for (const key of phase1Data.keys()) {
    const p1Stats = computeStats(phase1Data.get(key) || []);
    const p2Stats = computeStats(phase2Data.get(key) || []);
    const deltaAvg = Math.abs(p1Stats.avg - p2Stats.avg);
    if (p1Stats.n === 0 && p2Stats.n === 0) continue;
    rows.push({ key, p1: p1Stats, p2: p2Stats, deltaAvg });
  }

  process.stderr.write(`  sorting ${rows.length} registers...\n`);
  rows.sort((a, b) => b.deltaAvg - a.deltaAvg || b.p2.stddev - a.p2.stddev || b.p1.stddev - a.p1.stddev);

  const changed = rows.filter(e => e.deltaAvg > 0).length;
  const lines = [];
  lines.push(`Register Change Report`);
  lines.push(`======================`);
  lines.push(`Range: ${RANGE_START}-${RANGE_END}  Slaves: ${SLAVES.join(',')}`);
  lines.push(`Registers with |mean change| between phases: ${changed} changed / ${rows.length} total`);
  lines.push('');
  lines.push('slave  reg       Δavg        avg1       avg2       σ1         σ2         U1    U2    range1             range2             n1     n2');
  lines.push('-----  --------  ----------  ---------  ---------  ---------  ---------  ----  ----  -----------------  -----------------  -----  -----');

  for (const e of rows) {
    const [slave, reg] = e.key.split(':');
    const fmt = (v, w) => v.toFixed(1).padStart(w);
    lines.push(
      `${String(slave).padStart(5)}  ${String(reg).padStart(7)}  ` +
      `${fmt(e.deltaAvg, 9)}  ${fmt(e.p1.avg, 8)}  ${fmt(e.p2.avg, 8)}  ` +
      `${fmt(e.p1.stddev, 8)}  ${fmt(e.p2.stddev, 8)}  ` +
      `${String(e.p1.unique).padStart(4)}  ${String(e.p2.unique).padStart(4)}  ` +
      `[${e.p1.min},${e.p1.max}]`.padEnd(18) +
      `[${e.p2.min},${e.p2.max}]`.padEnd(18) +
      `${String(e.p1.n).padStart(5)}  ${String(e.p2.n).padStart(5)}`
    );
  }
  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  const out = createWriteStream(CSV_OUT);
  out.write(`# Live monitor — Holding Registers (0x03)\n`);
  out.write(`# Range: ${RANGE_START}-${RANGE_END}\n`);
  out.write(`# Started: ${new Date().toISOString()}\n`);
  out.write(`# Columns: timestamp,slave,register,uint16,hex,uint32_be,int32_be,float32_abcd,float32_cdab,phase\n`);
  out.write(`# Phase 1\n`);

  const client = new ModbusRTU({ timeout: TIMEOUT });
  await client.connectTCP(HOST, { port: PORT });

  // Phase data: Map<"slave:reg", number[]>
  const phase1 = new Map();
  const phase2 = new Map();

  function getMap(phaseNum) { return phaseNum === 1 ? phase1 : phase2; }
  function getOrCreate(map, key) {
    if (!map.has(key)) map.set(key, []);
    return map.get(key);
  }

  let currentPhase = 1;
  let running = true;
  let sampleCount = 0;

  // Use readline — clean line-by-line input, no CR/LF splitting
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  rl.on('line', () => {
    if (currentPhase === 1) {
      currentPhase = 2;
      out.write(`#\n# Phase 2\n`);
      process.stderr.write('\n─── Phase 2 (high load) ───\n');
    } else {
      running = false;
      process.stderr.write('\n─── Stopping (finishing current sample)... ───\n');
    }
  });

  process.stderr.write(`Live monitor — Input Registers (0x04) ${RANGE_START}-${RANGE_END}\n`);
  process.stderr.write(`Slaves: ${SLAVES.join(', ')} | Interval: ${INTERVAL}ms\n`);
  process.stderr.write(`─── Phase 1 (normal load) ───\n`);
  process.stderr.write(`Press ENTER = next phase / stop.\n\n`);

  // ── Monitoring loop ──────────────────────────────────────────
  while (running) {
    const ts = new Date().toISOString();
    const phase = currentPhase; // snapshot in case it changes mid-sample

    for (const id of SLAVES) {
      if (!running) break;
      let addr = RANGE_START;
      while (addr <= RANGE_END) {
        if (!running) break;
        const count = Math.min(100, RANGE_END - addr + 1);
        const data = await readBlock(client, id, addr, count);
        if (data) {
          for (let i = 0; i < data.length; i++) {
            const regAddr = addr + i;
            const val = data[i];
            const hex = '0x' + val.toString(16).padStart(4, '0');

            const hasNext = i + 1 < data.length;
            const nxt = hasNext ? data[i + 1] : null;
            const u32 = hasNext ? uint32BE(val, nxt) : '';
            const i32 = hasNext ? int32BE(val, nxt) : '';
            const f32abcd = hasNext ? fmtF32(float32ABCD(val, nxt)) : '';
            const f32cdab = hasNext ? fmtF32(float32CDAB(val, nxt)) : '';

            out.write(`${ts},${id},${regAddr},${val},${hex},${u32},${i32},${f32abcd},${f32cdab},${phase}\n`);

            const key = `${id}:${regAddr}`;
            getOrCreate(getMap(phase), key).push(val);
          }
          addr += data.length;
        } else {
          addr += 1;
        }
      }
    }

    sampleCount++;
    if (sampleCount % 10 === 0) {
      process.stderr.write(`  ${sampleCount}s (phase ${currentPhase})\n`);
    }

    if (running) await new Promise(r => setTimeout(r, INTERVAL));
  }

  rl.close();
  process.stderr.write(`Samples: ${sampleCount}. Closing...\n`);

  // Force-destroy socket — close() can hang
  try { client._port?.destroy?.(); } catch (e) {}
  try { client.close?.(); } catch (e) {}

  out.end();

  process.stderr.write(`Generating report...\n`);
  const report = generateReport(phase1, phase2);
  writeFileSync(REPORT_OUT, report);
  process.stderr.write(`Done.\n`);
  process.stderr.write(`CSV    → ${CSV_OUT}\n`);
  process.stderr.write(`Report → ${REPORT_OUT}\n`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
