import { randomUUID } from 'crypto';
import { emitRiegoUpdate } from '../socket.js';
import { loadConfig } from './shelly.js';
import { logRiegoEvent } from './riegoEvent.js';

const MAX_DURATION_MIN = 120;
const WATCHDOG_INTERVAL = 15000;
const STOP_RETRY_COUNT = 3;
const STOP_RETRY_DELAY = 2000;

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

function setCurrentStatus(status, statusRetry = 0) {
  if (state.current) {
    state.current.status = status;
    state.current.statusRetry = statusRetry;
  }
  emitState();
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
    // Report retry status after first attempt
    if (attempt > 0) {
      setCurrentStatus('disconnecting', attempt);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (response.ok) return true;

      const data = await response.json();
      if (data?.errors?.max_req) {
        console.warn(`Riego: rate limit on stopShelly for ${shellyId} ch${channel}, waiting before retry`);
        await new Promise(r => setTimeout(r, STOP_RETRY_DELAY));
        continue;
      }
      console.error(`Riego: stopShelly failed for ${shellyId} ch${channel}: HTTP ${response.status}`);
      return false;
    } catch (error) {
      console.error(`Riego: stopShelly error for ${shellyId} ch${channel} (attempt ${attempt + 1}):`, error.message);
      if (attempt < STOP_RETRY_COUNT - 1) {
        await new Promise(r => setTimeout(r, STOP_RETRY_DELAY));
      }
    }
  }

  console.error(`Riego: stopShelly failed for ${shellyId} ch${channel}`);
  return false;
}

async function startShelly(shellyId, channel, server, apiKey) {
  const url = getShellyEndpoint(server);
  const body = new URLSearchParams({
    id: shellyId,
    channel: String(channel),
    turn: 'on',
    auth_key: apiKey,
  });

  console.log(`Riego: startShelly -> POST ${url} body: ${body.toString()}`);

  for (let attempt = 0; attempt < STOP_RETRY_COUNT; attempt++) {
    if (attempt > 0) {
      setCurrentStatus('connecting', attempt);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = await response.json();

      if (response.ok && data.isok === true) {
        return true;
      }

      if (data?.errors?.max_req) {
        console.warn(`Riego: rate limit on startShelly for ${shellyId} ch${channel} (attempt ${attempt + 1}), waiting before retry`);
        await new Promise(r => setTimeout(r, STOP_RETRY_DELAY));
        continue;
      }

      console.error(`Riego: startShelly failed for ${shellyId} ch${channel}: HTTP ${response.status}, response:`, JSON.stringify(data));
      return false;
    } catch (error) {
      console.error(`Riego: startShelly error for ${shellyId} ch${channel} (attempt ${attempt + 1}):`, error.message);
      if (attempt < STOP_RETRY_COUNT - 1) {
        await new Promise(r => setTimeout(r, STOP_RETRY_DELAY));
      }
    }
  }

  return false;
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
      remaining: state.current.status === 'running'
        ? Math.max(0, Math.round((state.current.endTime - Date.now()) / 1000))
        : 0,
      status: state.current.status || 'running',
      statusRetry: state.current.statusRetry || 0,
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
    console.log('Riego: queue empty, all phases completed');
    return;
  }

  const next = state.queue.shift();
  console.log(`Riego: advancing to phase ${next.phaseId} (${next.name}), remaining in queue: ${state.queue.length}`);
  await startPhaseItem(next);
}

async function startPhaseItem(item) {
  const config = loadConfig();
  const phase = findPhase(item.phaseId);
  if (!phase) return;

  const durationMs = item.durationMin * 60 * 1000;

  const timerId = setTimeout(async () => {
    try {
      const config = loadConfig();
      const phase = findPhase(item.phaseId);
      if (state.current) {
        setCurrentStatus('disconnecting', 0);
      }
      let offSuccess = true;
      if (phase) {
        console.log(`Riego: phase ${item.phaseId} (${item.name}) timer expired, stopping Shelly`);
        offSuccess = await stopShelly(phase.shellyId, phase.channel, config.server, config.apiKey);
      }
      if (!offSuccess) {
        logRiegoEvent('ERROR', item.phaseId, item.name, {
          error: `Shelly OFF failed after ${STOP_RETRY_COUNT} attempts`,
        }).catch(err => console.error('Failed to log riego event:', err));
      }
      logRiegoEvent('STOPPED', item.phaseId, item.name, {
        stopReason: 'timeout',
      }).catch(err => console.error('Failed to log riego event:', err));
      await new Promise(r => setTimeout(r, 2000));
      await advanceQueue();
    } catch (error) {
      console.error(`Riego: timer callback error for phase ${item.phaseId}:`, error);
      logRiegoEvent('ERROR', item.phaseId, item.name, {
        error: error.message,
      }).catch(err => console.error('Failed to log riego event:', err));
    }
  }, durationMs);

  state.current = {
    queueId: item.queueId,
    phaseId: item.phaseId,
    name: item.name,
    shellyId: phase.shellyId,
    channel: phase.channel,
    durationMin: item.durationMin,
    startedAt: new Date().toISOString(),
    endTime: Date.now() + durationMs,
    timerId,
    status: 'connecting',
    statusRetry: 0,
  };

  emitState();

  const success = await startShelly(phase.shellyId, phase.channel, config.server, config.apiKey);
  console.log(`Riego: phase ${item.phaseId} (${item.name}) Shelly ON ${success ? 'OK' : 'FAILED'}`);

  if (success) {
    logRiegoEvent('STARTED', item.phaseId, item.name)
      .catch(err => console.error('Failed to log riego event:', err));
  } else {
    logRiegoEvent('ERROR', item.phaseId, item.name, {
      error: `Shelly ON failed after ${STOP_RETRY_COUNT} attempts`,
    }).catch(err => console.error('Failed to log riego event:', err));
  }

  if (state.current?.queueId === item.queueId) {
    state.current.status = 'running';
    state.current.statusRetry = 0;
    emitState();
  }
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

export async function stopCurrent(userId = null) {
  if (!state.current) return;

  const phaseId = state.current.phaseId;
  const phaseName = state.current.name;

  setCurrentStatus('disconnecting', 0);

  const config = loadConfig();
  const success = await stopShelly(state.current.shellyId, state.current.channel, config.server, config.apiKey);
  await new Promise(r => setTimeout(r, 2000));

  if (!success) {
    logRiegoEvent('ERROR', phaseId, phaseName, {
      error: `Shelly OFF failed after ${STOP_RETRY_COUNT} attempts`,
      userId,
    }).catch(err => console.error('Failed to log riego event:', err));
  }

  logRiegoEvent('STOPPED', phaseId, phaseName, {
    stopReason: 'manual',
    userId,
  }).catch(err => console.error('Failed to log riego event:', err));

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
    const phaseId = state.current.phaseId;
    const phaseName = state.current.name;
    clearTimer();
    state.current = null;

    logRiegoEvent('STOPPED', phaseId, phaseName, {
      stopReason: 'emergency',
    }).catch(err => console.error('Failed to log riego event:', err));
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
      const phaseId = state.current.phaseId;
      const phaseName = state.current.name;

      console.warn(`Riego watchdog: phase ${phaseId} overrun, force-stopping`);
      setCurrentStatus('disconnecting', 0);
      const config = loadConfig();
      await stopShelly(state.current.shellyId, state.current.channel, config.server, config.apiKey);

      logRiegoEvent('STOPPED', phaseId, phaseName, {
        stopReason: 'watchdog',
      }).catch(err => console.error('Failed to log riego event:', err));

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
