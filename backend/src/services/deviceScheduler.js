import { turnDeviceOn, turnDeviceOff, getDeviceById } from './shelly.js';
import { logActivity, ACTIONS } from './activityLog.js';
import { prisma } from '../config/passport.js';
import { emitDeviceUpdate } from '../socket.js';

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

    const timeCache = {};
    function getOrComputeLocalTime(tz) {
      if (!timeCache[tz]) {
        timeCache[tz] = getLocalTime(tz);
      }
      return timeCache[tz];
    }

    let matched = false;

    for (const act of activations) {
      const tz = act.plan.timezone || 'UTC';
      const localTime = getOrComputeLocalTime(tz);

      if (localTime === null) {
        console.warn(`[Scheduler]   device=${act.deviceId} plan="${act.plan.name}" SKIP: invalid timezone "${tz}"`);
        continue;
      }

      const planOn = act.plan.activationTime;
      const planOff = act.plan.deactivationTime;
      console.log(`[Scheduler]   device=${act.deviceId} plan="${act.plan.name}" tz=${tz} on=${planOn} off=${planOff} (local=${localTime}, utc=${utcTime})`);

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
  tick(); // run immediately on startup
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
