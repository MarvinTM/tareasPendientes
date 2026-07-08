import 'dotenv/config';
import ModbusRTU from 'modbus-serial';
import { createWriteStream } from 'fs';

const HOST = process.env.MODBUS_HOST || '192.168.1.100';
const PORT = parseInt(process.env.MODBUS_PORT || '502', 10);
const OUT = process.env.OUT || `dump-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
const TIMEOUT = 5000;

const DUMP_RANGES = [
  [30000, 30200],
  [32000, 32350],
  [37000, 37350],
  [47000, 47400],
];

// ── ModBus helpers ─────────────────────────────────────────────

async function tryRead(client, unitId, start, count) {
  try {
    client.setID(unitId);
    client.setTimeout(TIMEOUT);
    const result = await client.readHoldingRegisters(start, count);
    return { data: result.data };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Block dump (no interpretation, raw uint16) ─────────────────

async function dumpRange(client, unitId, out, start, end) {
  let addr = start;
  while (addr <= end) {
    const remaining = end - addr + 1;
    const count = Math.min(100, remaining);
    const res = await tryRead(client, unitId, addr, count);
    if (res.data) {
      for (let i = 0; i < res.data.length; i++) {
        const val = res.data[i];
        out.write(`${unitId},${addr + i},${val},0x${val.toString(16).padStart(4, '0')}\n`);
      }
      addr += res.data.length;
    } else {
      addr += 1;
    }
  }
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  const out = createWriteStream(OUT);
  out.write(`# ${new Date().toISOString()} — ${HOST}:${PORT}\n`);
  out.write(`slave,register,uint16,hex\n`);

  const client = new ModbusRTU({ timeout: TIMEOUT });
  await client.connectTCP(HOST, { port: PORT });

  for (let id = 1; id <= 10; id++) {
    // Validate: must return model or serial
    const modelRes = await tryRead(client, id, 30000, 15);
    const snRes = await tryRead(client, id, 30015, 10);
    if (!modelRes.data && !snRes.data) continue;

    process.stderr.write(`Slave ${id}: valid (model or serial returned)\n`);

    for (const [s, e] of DUMP_RANGES) {
      process.stderr.write(`  dumping ${s}-${e}...\n`);
      await dumpRange(client, id, out, s, e);
    }
  }

  client.close();
  out.end();
  process.stderr.write(`Done → ${OUT}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
