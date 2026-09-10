// In-memory status cache for pulse flow sensors (Shelly Plus Uni counter input).
//
// Same role as shellyLocalStatus.js does for relays: the Raspberry Pi polls the
// sensor over the LAN and POSTs to /api/ingestion/flow, and this cache keeps the
// last summary so /api/devices can answer without touching the database.
//
// Two different freshness rules on purpose:
//   - getFlowStatus() expires (a sensor that stopped reporting must read as
//     "sin conexión", not as a stale flow rate).
//   - getLastReading() never expires: it is the baseline for the pulse delta,
//     and an hour-old counter total is still the correct baseline.
//
// The cache is empty after a backend restart, so the sensor reads as offline
// until the next forwarder POST (one poll interval). /api/flow/* reads the
// database instead, so history and the Agua page are never affected by this.

export const FLOW_FRESHNESS_MS = Number(process.env.FLOW_FRESHNESS_MS) || 90000;

const store = new Map();

export function updateFlowStatus(sensorId, data) {
  const prev = store.get(sensorId);
  store.set(sensorId, {
    online: data.online ?? false,
    pulsesTotal: data.pulsesTotal ?? prev?.pulsesTotal ?? null,
    lastReadingAt: data.lastReadingAt ?? prev?.lastReadingAt ?? null,
    freqHz: data.freqHz ?? null,
    rateLpm: data.rateLpm ?? null,
    todayLitres: data.todayLitres ?? null,
    updatedAt: Date.now(),
  });
}

export function getFlowStatus(sensorId, maxAgeMs = FLOW_FRESHNESS_MS) {
  const entry = store.get(sensorId);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt >= maxAgeMs) return null;
  return {
    online: entry.online,
    rateLpm: entry.rateLpm,
    todayLitres: entry.todayLitres,
    lastReadingAt: entry.lastReadingAt,
  };
}

// Baseline for the delta calculation — intentionally ignores freshness.
export function getLastReading(sensorId) {
  const entry = store.get(sensorId);
  if (!entry || entry.pulsesTotal == null || !entry.lastReadingAt) return null;
  return { pulsesTotal: entry.pulsesTotal, timestamp: entry.lastReadingAt };
}

export function _reset() {
  store.clear();
}
