const FRESHNESS_MS = Number(process.env.SHELLY_LOCAL_FRESHNESS_MS) || 30000;

const store = new Map();

export function updateShellyStatus(entries) {
  const now = Date.now();
  for (const entry of entries) {
    store.set(entry.shellyId, {
      online: entry.online ?? false,
      relays: entry.relays ?? [],
      updatedAt: now,
    });
  }
}

export function getShellyStatus(shellyId, maxAgeMs = FRESHNESS_MS) {
  const entry = store.get(shellyId);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt >= maxAgeMs) return null;
  return { online: entry.online, relays: entry.relays };
}

// Record a relay state confirmed by a local command, so status reads stay
// local until the next forwarder push instead of falling back to the cloud.
export function setRelayState(shellyId, channel, on) {
  const entry = store.get(shellyId);
  if (!entry) return;
  entry.relays[channel] = { on };
  entry.online = true;
  entry.updatedAt = Date.now();
}

export function markStale(shellyId) {
  const entry = store.get(shellyId);
  if (entry) {
    entry.updatedAt = 0;
  }
}

export function _reset() {
  store.clear();
}