import 'dotenv/config';
import ModbusRTU from 'modbus-serial';
import { REGISTERS, computeDerived } from './huawei-registers.js';

const HOST = process.env.MODBUS_HOST || '192.168.1.100';
const PORT = parseInt(process.env.MODBUS_PORT || '502', 10);
const TIMEOUT = 8000;
const DEBUG = process.env.DEBUG === '1';

// Blocks for ALL inverters (identity, status, PV, yield, grid)
const COMMON_BLOCKS = [
  { start: 30000, count: 30 },
  { start: 30070, count: 20 },
  { start: 31000, count: 20 },
  { start: 32000, count: 30 },
  { start: 32060, count: 30 },
  { start: 32080, count: 20 },
  { start: 37100, count: 30 },   // Meter data
  { start: 40100, count: 30 },   // Power limit config
];

// Additional blocks for battery (Master only)
const BATTERY_BLOCKS = [
  { start: 37000, count: 20 },   // Battery live telemetry
  { start: 47000, count: 30 },
  { start: 47030, count: 30 },
  { start: 47070, count: 30 },
  { start: 47100, count: 30 },
  { start: 47140, count: 30 },
  { start: 47400, count: 40 },
];

// ── Decoding ───────────────────────────────────────────────────

function parseString(registers) {
  const buf = Buffer.alloc(registers.length * 2);
  for (let i = 0; i < registers.length; i++) buf.writeUInt16BE(registers[i], i * 2);
  return buf.toString('ascii').replace(/\0/g, '').trim();
}

function uint16(raw, scale = 1) { return raw[0] * scale; }
function uint32(raw, scale = 1) { return ((raw[0] * 65536) + raw[1]) * scale; }
function int32(raw, scale = 1) {
  const u = uint32(raw);
  return u >= 0x80000000 ? (u - 0x100000000) * scale : u * scale;
}
function int16(raw, scale = 1) {
  let v = raw[0];
  if (v >= 0x8000) v -= 0x10000;
  return v * scale;
}

function decode(raw, reg) {
  switch (reg.type) {
    case 'string': return parseString(raw);
    case 'uint16': return uint16(raw, reg.scale || 1);
    case 'int16':  return int16(raw, reg.scale || 1);
    case 'uint32': return uint32(raw, reg.scale || 1);
    case 'int32':  return int32(raw, reg.scale || 1);
    default:       return raw[0];
  }
}

function formatVal(val, reg) {
  if (reg.type === 'string') return val ? `"${val}"` : '<empty>';
  if (reg.map && reg.map[val] !== undefined) return `${val} (${reg.map[val]})`;
  const dec = (reg.scale && reg.scale < 1) ? 2 : 0;
  const num = typeof val === 'number' ? val.toFixed(dec).replace(/\.0+$/, '') : val;
  return reg.unit ? `${num} ${reg.unit}` : String(num);
}

// ── Block reader ───────────────────────────────────────────────

async function readBlock(client, unitId, start, count) {
  try {
    client.setID(unitId);
    return (await client.readHoldingRegisters(start, count)).data;
  } catch (e) { return null; }
}

async function fetchBlocks(client, unitId, blocks) {
  const cache = {};
  for (const b of blocks) {
    const d = await readBlock(client, unitId, b.start, b.count);
    if (d) cache[b.start] = d;
  }
  return cache;
}

function sliceBlock(cache, addr, count) {
  for (const [start, data] of Object.entries(cache)) {
    const s = parseInt(start);
    if (addr >= s && addr + count - 1 < s + data.length)
      return data.slice(addr - s, addr - s + count);
  }
  return null;
}

// ── Display helpers ────────────────────────────────────────────

function printLine(label, formatted, desc) {
  const line = `  ${label.padEnd(20)} ${formatted}`;
  if (desc) console.log(`${line}  (${desc})`);
  else console.log(line);
}

function sectionLine(title) {
  console.log(`\n  ${title}`);
  console.log('  ' + '-'.repeat(55));
}

// ── Per-inverter scan ──────────────────────────────────────────

async function scanInverter(client, unitId, label, hasBattery, hasMeter) {
  console.log(`\n=== ${label} (unit ${unitId}) ===`);

  try { await readBlock(client, unitId, 30070, 1); } catch (e) {}

  // Build block list for this unit
  const blocks = [...COMMON_BLOCKS];
  if (hasBattery) blocks.push(...BATTERY_BLOCKS);
  const cache = await fetchBlocks(client, unitId, blocks);

  // Filter registers for this unit
  const regs = REGISTERS.filter(r => {
    if (r.meter && !hasMeter) return false;
    if (r.battery && !hasBattery) return false;
    return true;
  });

  const values = {};
  const rawMap = {};
  for (const reg of regs) {
    const raw = sliceBlock(cache, reg.addr, reg.count);
    if (raw) {
      rawMap[reg.label] = raw;
      values[reg.label] = decode(raw, reg);
    } else {
      values[reg.label] = null;
    }
  }

  const derived = computeDerived(values);

  let curSec = null;
  const bounds = [
    { label: 'Identity',        end: 30099 },
    { label: 'Status',          end: 32009 },
    { label: 'PV Strings',      end: 32019 },
    { label: 'Yield & Grid',    end: 32099 },
    { label: 'Battery',         end: 37099 },
    { label: 'Meter',           end: 37199 },
    { label: 'Grid Limits',     end: 40199 },
    { label: 'Battery Config',  end: 47499 },
    { label: 'Energy Balance',  end: -2 },
  ];

  for (const reg of regs) {
    const sec = bounds.find(s => reg.addr <= s.end);
    if (sec && sec.label !== curSec) { curSec = sec.label; sectionLine(curSec); }

    const val = values[reg.label];
    if (val === null) {
      if (reg.desc) printLine(reg.label, '<unavailable>');
      continue;
    }

    const formatted = formatVal(val, reg);
    if (DEBUG) {
      const raw = rawMap[reg.label];
      const hex = raw ? raw.map(r => r.toString(16).padStart(4, '0')).join(' ') : '?';
      console.log(`  ${reg.label.padEnd(20)} ${formatted}  [${hex}]  ${reg.desc || ''}`);
    } else if (reg.desc) {
      printLine(reg.label, formatted, reg.desc);
    } else {
      printLine(reg.label, formatted);
    }
  }

  if (Object.keys(derived).length > 0) {
    sectionLine('Energy Balance');
    for (const [label, info] of Object.entries(derived)) {
      const v = info.value;
      const num = (typeof v === 'number' && Number.isFinite(v))
        ? (Number.isInteger(v) ? String(v) : v.toFixed(1))
        : (typeof v === 'number' ? String(Math.round(v)) : String(v));
      const formatted = info.unit ? `${num} ${info.unit}` : String(num);
      printLine(label, formatted, info.desc);
    }
  }

  // Return key values for system summary
  return {
    activePower: values['Active Power'],
    pv1Power: derived['MPPT1 Power']?.value || 0,
    pv2Power: derived['MPPT2 Power']?.value || 0,
    meterPower: values['Meter Active Power'],
  };
}

// ── System Summary ─────────────────────────────────────────────

function printSystemSummary(master, slave) {
  sectionLine('SYSTEM SUMMARY');

  const totalAc = (master.activePower || 0) + (slave.activePower || 0);
  const meterPwr = master.meterPower;
  const totalPv = master.pv1Power + master.pv2Power + slave.pv1Power + slave.pv2Power;

  printLine('Master AC Power', `${master.activePower ?? '?'} W`);
  printLine('Slave AC Power', `${slave.activePower ?? '?'} W`);
  printLine('Total AC Generation', `${totalAc} W`, 'Master + Slave');

  if (meterPwr !== null && meterPwr !== undefined) {
    const houseLoad = totalAc - meterPwr;
    const direction = meterPwr >= 0 ? 'import' : 'export';
    const absMeter = Math.abs(meterPwr);
    printLine('Grid Meter', `${absMeter} W ${direction}`, '+ = import, − = export');
    printLine('House Consumption', `${houseLoad} W`, 'Total AC − Grid Meter');
  }

  if (totalPv > 0) {
    const eff = totalAc / totalPv * 100;
    printLine('Total PV DC', `${totalPv} W`, 'All MPPT inputs');
    printLine('System Efficiency', `${Math.round(eff)} %`, 'AC ÷ DC');
  }
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`Connecting to ${HOST}:${PORT}...`);
  const client = new ModbusRTU({ timeout: TIMEOUT });
  await client.connectTCP(HOST, { port: PORT });
  client.setTimeout(TIMEOUT);
  console.log('Connected.');

  // Master: has battery + meter
  const master = await scanInverter(client, 1, 'Master', true, true);
  // Slave: no battery, no meter
  const slave = await scanInverter(client, 2, 'Slave', false, false);

  printSystemSummary(master, slave);

  console.log('\nDone.');
  client.close();
}

main();
