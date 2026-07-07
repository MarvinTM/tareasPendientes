import { turnDeviceOn, turnDeviceOff, getDeviceById } from './shelly.js';
import { logActivity, ACTIONS } from './activityLog.js';
import { prisma } from '../config/passport.js';
import { emitDeviceUpdate } from '../socket.js';

let schedulerTimer = null;
let initialized = false;

function getCurrentTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

async function tick() {
  try {
    const currentTime = getCurrentTime();
    const activations = await prisma.deviceActivation.findMany({
      include: { plan: true },
    });

    for (const act of activations) {
      const device = getDeviceById(act.deviceId);
      if (!device) continue;

      if (act.plan.activationTime === currentTime) {
        try {
          const result = await turnDeviceOn(act.deviceId);
          emitDeviceUpdate({ id: act.deviceId, ...device, ...result });
          logActivity(null, ACTIONS.DEVICE_TURNED_ON, act.deviceId, device.name, {
            scheduled: true,
            planId: act.planId,
            planName: act.plan.name,
          }).catch(err => console.error('Failed to log scheduled activation:', err));
        } catch (err) {
          console.error(`Scheduler: failed to turn on ${act.deviceId}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 5000));
      }

      if (act.plan.deactivationTime === currentTime) {
        try {
          const result = await turnDeviceOff(act.deviceId);
          emitDeviceUpdate({ id: act.deviceId, ...device, ...result });
          logActivity(null, ACTIONS.DEVICE_TURNED_OFF, act.deviceId, device.name, {
            scheduled: true,
            planId: act.planId,
            planName: act.plan.name,
          }).catch(err => console.error('Failed to log scheduled deactivation:', err));
        } catch (err) {
          console.error(`Scheduler: failed to turn off ${act.deviceId}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  } catch (err) {
    console.error('Scheduler tick error:', err);
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
