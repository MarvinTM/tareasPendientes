import ModbusRTU from 'modbus-serial';

const TIMEOUT = 5000;

export async function connect(host, port) {
  const client = new ModbusRTU({ timeout: TIMEOUT });
  await client.connectTCP(host, { port });
  client.setTimeout(TIMEOUT);
  return client;
}

export async function readHoldingRegisters(client, unitId, address, length) {
  client.setID(unitId);
  const result = await client.readHoldingRegisters(address, length);
  return result.data;
}

export async function readInputRegisters(client, unitId, address, length) {
  client.setID(unitId);
  const result = await client.readInputRegisters(address, length);
  return result.data;
}

export function parseString(registers) {
  const buffer = Buffer.alloc(registers.length * 2);
  for (let i = 0; i < registers.length; i++) {
    buffer.writeUInt16BE(registers[i], i * 2);
  }
  return buffer.toString('ascii').replace(/\0/g, '').trim();
}

export function parseInt32(registers) {
  if (registers.length < 2) return null;
  return (registers[0] << 16) | registers[1];
}

export function parseUInt32(registers) {
  if (registers.length < 2) return null;
  const hi = registers[0] >>> 0;
  const lo = registers[1] >>> 0;
  return hi * 65536 + lo;
}

export function disconnect(client) {
  client.close();
}
