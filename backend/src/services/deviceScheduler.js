import { getTimes } from 'suncalc';
import { turnDeviceOn, turnDeviceOff, getDeviceById } from './shelly.js';
import { logActivity, ACTIONS } from './activityLog.js';
import { prisma } from '../config/passport.js';
import { emitDeviceUpdate } from '../socket.js';

const ALBERITE = { lat: 42.4067, lng: -2.4381 };
const TIMEZONE = 'Europe/Madrid';

let schedulerTimer = null;
let initialized = false;

function getLocalTime(timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
    return parts;
  } catch {
    return null;
  }
}

export function computeSunTime(type) {
  const times = getTimes(new Date(), ALBERITE.lat, ALBERITE.lng);
  const date = type === 'sunrise' ? times.sunrise : times.sunset;
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function resolveTime(mode, fixedTime, sunTime) {
  if (mode === 'sunrise') return sunTime.sunrise;
  if (mode === 'sunset') return sunTime.sunset;
  return fixedTime;
}

function modeLabel(mode) {
  if (mode === 'sunrise') return 'amanecer';
  if (mode === 'sunset') return 'anochecer';
  return 'fijo';
}

async function tick() {
  const nowFull = new Date().toISOString();
  const utcTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(new Date());
  console.log(`[Scheduler] === tick at ${utcTime} UTC (${nowFull}) ===`);

  try {
    const activations = await prisma.deviceActivation.findMany({
      include: { plan: true },
    });

    if (activations.length === 0) {
      console.log('[Scheduler] no DeviceActivation records found in DB — nothing to schedule');
      return;
    }

    console.log(`[Scheduler] found ${activations.length} activation record(s)`);

    const localTime = getLocalTime(TIMEZONE);
    const sunTime = { sunrise: computeSunTime('sunrise'), sunset: computeSunTime('sunset') };
    console.log(`[Scheduler] local=${localTime} sun=${sunTime.sunrise}/${sunTime.sunset}`);

    let matched = false;

    for (const act of activations) {
      const actMode = act.plan.activationMode || 'fixed';
      const deactMode = act.plan.deactivationMode || 'fixed';
      const planOn = resolveTime(actMode, act.plan.activationTime, sunTime);
      const planOff = resolveTime(deactMode, act.plan.deactivationTime, sunTime);

      console.log(`[Scheduler]   device=${act.deviceId} plan="${act.plan.name}" on=${planOn}(${modeLabel(actMode)}) off=${planOff}(${modeLabel(deactMode)}) (local=${localTime})`);

      const device = getDeviceById(act.deviceId);
      if (!device) {
        console.warn(`[Scheduler]   SKIP: device "${act.deviceId}" not found in shelly.json`);
        continue;
      }

      if (planOn === localTime) {
        matched = true;
        console.log(`[Scheduler]   MATCH ON → triggering ${act.deviceId} (${device.name})`);
        try {
          const result = await turnDeviceOn(act.deviceId);
          emitDeviceUpdate({ id: act.deviceId, ...device, ...result });
          console.log(`[Scheduler]   ON success for ${act.deviceId}`);
          logActivity(null, ACTIONS.DEVICE_TURNED_ON, act.deviceId, device.name, {
            scheduled: true,
            planId: act.planId,
            planName: act.plan.name,
          }).catch(err => console.error('Failed to log scheduled activation:', err));
        } catch (err) {
          console.error(`[Scheduler]   ON FAILED for ${act.deviceId}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 5000));
      }

      if (planOff === localTime) {
        matched = true;
        console.log(`[Scheduler]   MATCH OFF → triggering ${act.deviceId} (${device.name})`);
        try {
          const result = await turnDeviceOff(act.deviceId);
          emitDeviceUpdate({ id: act.deviceId, ...device, ...result });
          console.log(`[Scheduler]   OFF success for ${act.deviceId}`);
          logActivity(null, ACTIONS.DEVICE_TURNED_OFF, act.deviceId, device.name, {
            scheduled: true,
            planId: act.planId,
            planName: act.plan.name,
          }).catch(err => console.error('Failed to log scheduled deactivation:', err));
        } catch (err) {
          console.error(`[Scheduler]   OFF FAILED for ${act.deviceId}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    if (!matched) {
      console.log(`[Scheduler] no activation/deactivation matched local time (utc=${utcTime})`);
    }

    console.log(`[Scheduler] === tick done ===`);
  } catch (err) {
    console.error('[Scheduler] tick error:', err.message, err.stack);
  }
}

export function init() {
  if (initialized) return;
  initialized = true;
  console.log('Device scheduler started');
  tick();
  schedulerTimer = setInterval(tick, 60000);
}

export function _reset() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  initialized = false;
}

export async function _tick() {
  await tick();
}
