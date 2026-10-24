// Relay commands sent to the Shellys over the LAN through the local component.
//
// The Pi cannot be reached from the internet, so it long-polls
// GET /api/ingestion/commands and the backend answers that held request as
// soon as a command is queued. The Pi runs it against the device and reports
// back via POST /api/ingestion/commands/:id/result.
//
// Every outcome tells the caller whether the command was *delivered* to the
// Pi. An undelivered command certainly never reached the device, so the cloud
// API can safely be used instead; a delivered one with no result is ambiguous.

import { randomUUID } from 'crypto';

const DELIVERY_TIMEOUT_MS = Number(process.env.LOCAL_COMMAND_DELIVERY_TIMEOUT_MS) || 3000;
const RESULT_TIMEOUT_MS = Number(process.env.LOCAL_COMMAND_RESULT_TIMEOUT_MS) || 8000;
// The Pi re-polls immediately after each answer, so a gap longer than this
// between polls means it is gone.
const POLL_GAP_MS = Number(process.env.LOCAL_COMMAND_POLL_GAP_MS) || 5000;

let waiter = null;
let lastPollAt = 0;
const queue = [];
const inFlight = new Map();

export function isLocalControlAvailable() {
  return waiter !== null || Date.now() - lastPollAt < POLL_GAP_MS;
}

// command: { shellyId, channel, action: 'on' | 'off' | 'pulse' }
// Resolves (never rejects) to { delivered, ok, on?, error? }.
export function sendLocalCommand(command) {
  return new Promise(resolve => {
    const entry = {
      command: { id: randomUUID(), ...command },
      resolve,
      timer: null,
    };

    entry.timer = setTimeout(() => {
      const idx = queue.indexOf(entry);
      if (idx !== -1) queue.splice(idx, 1);
      resolve({ delivered: false, ok: false, error: 'not picked up by local component' });
    }, DELIVERY_TIMEOUT_MS);

    queue.push(entry);
    flush();
  });
}

function flush() {
  if (!waiter || queue.length === 0) return;

  const entries = queue.splice(0, queue.length);
  const { res } = waiter;
  waiter = null;

  for (const entry of entries) {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      inFlight.delete(entry.command.id);
      entry.resolve({ delivered: true, ok: false, error: 'no result from local component' });
    }, RESULT_TIMEOUT_MS);
    inFlight.set(entry.command.id, entry);
  }

  res.json({ commands: entries.map(e => e.command) });
}

// Long-poll handler: hold the request until a command arrives or waitMs elapses.
export function waitForCommands(req, res, waitMs) {
  lastPollAt = Date.now();

  // Only one local component is expected; a newer poll supersedes an older one.
  if (waiter) {
    clearTimeout(waiter.timer);
    waiter.res.json({ commands: [] });
  }

  const self = {
    res,
    timer: setTimeout(() => {
      if (waiter === self) {
        waiter = null;
        lastPollAt = Date.now();
        res.json({ commands: [] });
      }
    }, waitMs),
  };
  waiter = self;

  req.on('close', () => {
    if (waiter === self) {
      clearTimeout(self.timer);
      waiter = null;
    }
  });

  flush();
}

export function completeCommand(id, result) {
  const entry = inFlight.get(id);
  if (!entry) return false;
  inFlight.delete(id);
  clearTimeout(entry.timer);
  entry.resolve({
    delivered: true,
    ok: result?.ok === true,
    on: typeof result?.on === 'boolean' ? result.on : null,
    error: result?.error ?? null,
  });
  return true;
}

export function _reset() {
  if (waiter) clearTimeout(waiter.timer);
  waiter = null;
  lastPollAt = 0;
  for (const e of queue) clearTimeout(e.timer);
  queue.length = 0;
  for (const e of inFlight.values()) clearTimeout(e.timer);
  inFlight.clear();
}
