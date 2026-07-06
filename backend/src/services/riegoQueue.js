import { randomUUID } from 'crypto';
import { emitRiegoUpdate } from '../socket.js';
import { loadConfig } from './shelly.js';

const MAX_DURATION_MIN = 120;
const WATCHDOG_INTERVAL = 15000;
const STOP_RETRY_COUNT = 3;
const STOP_RETRY_DELAY = 2000;
const OFF_TIMER_SECONDS = 5;

let state = {
  current: null,
  queue: [],
};

let watchdogTimer = null;
let durationMemory = new Map();
let initialized = false;
let sigtermHandler = null;
let sigintHandler = null;

function getPhases() {
  const config = loadConfig();
  if (!config.riego || !Array.isArray(config.riego.phases)) {
    return [];
  }
  return config.riego.phases.map(p => ({
    id: p.id,
    name: p.name || p.id,
    shellyId: p.shellyId,
    channel: p.channel ?? 0,
  }));
}

function findPhase(phaseId) {
  return getPhases().find(p => p.id === phaseId) || null;
}

function getShellyEndpoint(server) {
  return `${server}/device/relay/control`;
}

async function stopShelly(shellyId, channel, server, apiKey) {
  const url = getShellyEndpoint(server);
  const body = new URLSearchParams({
    id: shellyId,
    channel: String(channel),
    turn: 'off',
    auth_key: apiKey,
  });

  for (let attempt = 0; attempt < STOP_RETRY_COUNT; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (response.ok) return true;
      console.error(`stopShelly failed for ${shellyId} ch${channel}: HTTP ${response.status} (attempt ${attempt + 1})`);
    } catch (error) {
      console.error(`stopShelly error for ${shellyId} ch${channel} (attempt ${attempt + 1}):`, error.message);
    }
    if (attempt < STOP_RETRY_COUNT - 1) {
      await new Promise(r => setTimeout(r, STOP_RETRY_DELAY));
    }
  }

  console.error(`stopShelly failed after ${STOP_RETRY_COUNT} attempts for ${shellyId} ch${channel}`);
  return false;
}

async function startShelly(shellyId, channel, server, apiKey) {
  const url = getShellyEndpoint(server);
  const body = new URLSearchParams({
    id: shellyId,
    channel: String(channel),
    turn: 'on',
    timer: String(OFF_TIMER_SECONDS),
    auth_key: apiKey,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      console.error(`startShelly failed for ${shellyId} ch${channel}: HTTP ${response.status}`);
      return false;
    }
    const data = await response.json();
    return data.isok === true;
  } catch (error) {
    console.error(`startShelly error for ${shellyId} ch${channel}:`, error.message);
    return false;
  }
}

function emitState() {
  emitRiegoUpdate(getPublicState());
}

function getPublicState() {
  return {
    current: state.current ? {
      queueId: state.current.queueId,
      phaseId: state.current.phaseId,
      name: state.current.name,
      durationMin: state.current.durationMin,
      remaining: Math.max(0, Math.round((state.current.endTime - Date.now()) / 1000)),
    } : null,
    queue: state.queue.map(item => ({
      queueId: item.queueId,
      phaseId: item.phaseId,
      name: item.name,
      durationMin: item.durationMin,
    })),
    phases: getPhases().map(p => ({ id: p.id, name: p.name })),
    durationMemory: Object.fromEntries(durationMemory),
  };
}

function clearTimer() {
  if (state.current?.timerId) {
    clearTimeout(state.current.timerId);
    state.current.timerId = null;
  }
}

async function advanceQueue() {
  clearTimer();

  if (state.queue.length === 0) {
    state.current = null;
    emitState();
    return;
  }

  const next = state.queue.shift();
  await startPhaseItem(next);
}

async function startPhaseItem(item) {
  const config = loadConfig();
  const phase = findPhase(item.phaseId);
  if (!phase) return;

  const durationMs = item.durationMin * 60 * 1000;
  const endTime = Date.now() + durationMs;

  const success = await startShelly(phase.shellyId, phase.channel, config.server, config.apiKey);

  const timerId = setTimeout(() => {
    const config = loadConfig();
    const phase = findPhase(item.phaseId);
    if (phase) {
      stopShelly(phase.shellyId, phase.channel, config.server, config.apiKey);
    }
    advanceQueue();
  }, durationMs);

  state.current = {
    queueId: item.queueId,
    phaseId: item.phaseId,
    name: item.name,
    shellyId: phase.shellyId,
    channel: phase.channel,
    durationMin: item.durationMin,
    startedAt: new Date().toISOString(),
    endTime,
    timerId,
    started: success,
  };

  emitState();
}

export function getState() {
  return getPublicState();
}

export function enqueue(phaseId, durationMin) {
  const phase = findPhase(phaseId);
  if (!phase) {
    throw new Error(`Fase no encontrada: ${phaseId}`);
  }

  const duration = Number(durationMin);
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_MIN) {
    throw new Error(`Duración inválida. Debe ser entre 1 y ${MAX_DURATION_MIN} minutos.`);
  }

  durationMemory.set(phaseId, duration);

  const item = {
    queueId: randomUUID(),
    phaseId: phase.id,
    name: phase.name,
    shellyId: phase.shellyId,
    channel: phase.channel,
    durationMin: duration,
  };

  state.queue.push(item);

  if (!state.current) {
    // advanceQueue is async but called without await intentionally:
    // the queue kicks off and emits state via socket when Shelly confirms.
    // The immediate return gives the caller a quick response.
    advanceQueue();
  } else {
    emitState();
  }

  return item.queueId;
}

export function dequeue(queueId) {
  if (state.current?.queueId === queueId) {
    return false;
  }

  const index = state.queue.findIndex(item => item.queueId === queueId);
  if (index === -1) {
    return false;
  }

  state.queue.splice(index, 1);
  emitState();
  return true;
}

export async function stopCurrent() {
  if (!state.current) return;

  const config = loadConfig();
  await stopShelly(state.current.shellyId, state.current.channel, config.server, config.apiKey);
  await advanceQueue();
}

export async function startupSafetyCheck() {
  const config = loadConfig();
  if (!config.riego?.phases) return;

  const phases = getPhases();
  const seen = new Set();
  const promises = [];

  for (const phase of phases) {
    const key = `${phase.shellyId}:${phase.channel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    promises.push(stopShelly(phase.shellyId, phase.channel, config.server, config.apiKey));
  }

  await Promise.allSettled(promises);
  console.log('Riego: startup safety check completed');
}

export async function emergencyStopAll() {
  if (state.current) {
    clearTimer();
    state.current = null;
  }

  const config = loadConfig();
  if (!config.riego?.phases) return;

  const phases = getPhases();
  const seen = new Set();
  const promises = [];

  for (const phase of phases) {
    const key = `${phase.shellyId}:${phase.channel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    promises.push(stopShelly(phase.shellyId, phase.channel, config.server, config.apiKey));
  }

  await Promise.allSettled(promises);
  state.queue = [];
  emitState();
  console.log('Riego: emergency stop completed');
}

function startWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);

  watchdogTimer = setInterval(async () => {
    if (!state.current) return;

    if (Date.now() > state.current.endTime + WATCHDOG_INTERVAL) {
      console.warn(`Riego watchdog: phase ${state.current.phaseId} overrun, force-stopping`);
      const config = loadConfig();
      await stopShelly(state.current.shellyId, state.current.channel, config.server, config.apiKey);
      await advanceQueue();
    }
  }, WATCHDOG_INTERVAL);
}

export function init() {
  if (initialized) return;
  initialized = true;

  startupSafetyCheck();
  startWatchdog();

  sigtermHandler = async () => {
    console.log('Riego: SIGTERM received, emergency stop...');
    await emergencyStopAll();
    process.exit(0);
  };

  sigintHandler = async () => {
    console.log('Riego: SIGINT received, emergency stop...');
    await emergencyStopAll();
    process.exit(0);
  };

  process.on('SIGTERM', sigtermHandler);
  process.on('SIGINT', sigintHandler);
}

export function _reset() {
  clearTimer();
  state = { current: null, queue: [] };
  durationMemory = new Map();
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  if (sigtermHandler) {
    process.removeListener('SIGTERM', sigtermHandler);
    sigtermHandler = null;
  }
  if (sigintHandler) {
    process.removeListener('SIGINT', sigintHandler);
    sigintHandler = null;
  }
  initialized = false;
}
