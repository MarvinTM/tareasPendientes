import 'dotenv/config';
import ModbusRTU from 'modbus-serial';

const HOST = process.env.MODBUS_HOST || '192.168.1.100';
const PORT = parseInt(process.env.MODBUS_PORT || '502', 10);
const TIMEOUT = 8000;

const RANGES = [
  { start: 30000, count: 90,  label: 'Device Info (30000-30089)' },
  { start: 31000, count: 20,  label: 'Firmware (31000-31019)' },
  { start: 32000, count: 100, label: 'Operational Data (32000-32099)' },
  { start: 32100, count: 100, label: 'Operational Data (32100-32199)' },
  { start: 33000, count: 100, label: 'Counters (33000-33099)' },
  { start: 34000, count: 100, label: 'Counters (34000-34099)' },
  { start: 37000, count: 200, label: 'String/Per-panel (37000-37199)' },
  { start: 37200, count: 100, label: 'String IDs (37200-37299)' },
  { start: 47000, count: 100, label: 'Battery Status (47000-47099)' },
  { start: 47100, count: 100, label: 'Battery Config (47100-47199)' },
  { start: 47200, count: 100, label: 'Battery Power (47200-47299)' },
  { start: 47300, count: 100, label: 'Battery Settings (47300-47399)' },
  { start: 47400, count: 100, label: 'Battery Limits (47400-47499)' },
];

function hexDump(data, baseAddr) {
  const lines = [];
  for (let i = 0; i < data.length; i += 8) {
    const addr = baseAddr + i;
    const chunk = data.slice(i, i + 8);
    const hexParts = chunk.map(v => v.toString(16).padStart(4, '0'));
    const hexStr = hexParts.join(' ');
    const ascii = chunk.map(v => {
      const hi = String.fromCharCode((v >> 8) & 0xff);
      const lo = String.fromCharCode(v & 0xff);
      return ((hi >= ' ' && hi <= '~') ? hi : '.') + ((lo >= ' ' && lo <= '~') ? lo : '.');
    }).join('');
    lines.push(`  ${String(addr).padStart(5)}: ${hexStr}  ${ascii}`);
  }
  return lines.join('\n');
}

async function readBlock(client, unitId, start, count) {
  try {
    client.setID(unitId);
    const result = await client.readHoldingRegisters(start, count);
    return result.data;
  } catch (err) {
    return null;
  }
}

async function dumpInverter(client, unitId, name) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`INVERTER: ${name} (unit ${unitId})`);
  console.log(`${'='.repeat(70)}`);

  // Warm-up
  try { await readBlock(client, unitId, 30070, 1); } catch (e) {}

  for (const range of RANGES) {
    console.log(`\n--- ${range.label} ---`);
    const data = await readBlock(client, unitId, range.start, range.count);
    if (!data) {
      console.log('  <read failed>');
      continue;
    }

    const nonZero = data.filter(v => v !== 0).length;
    console.log(`  Non-zero registers: ${nonZero}/${data.length}`);
    console.log(hexDump(data, range.start));
  }
}

async function main() {
  console.log(`MODBUS DUMP — ${HOST}:${PORT}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const client = new ModbusRTU({ timeout: TIMEOUT });
  await client.connectTCP(HOST, { port: PORT });
  client.setTimeout(TIMEOUT);

  await dumpInverter(client, 1, 'Master');
  await dumpInverter(client, 2, 'Slave');

  client.close();
  console.log('\n=== END OF DUMP ===');
}

main();
