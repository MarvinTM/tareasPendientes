import { prisma } from '../config/passport.js';

export async function logActivity(userId, action, targetId = null, targetName = null, details = null) {
  return prisma.activityLog.create({
    data: {
      userId: userId || null,
      action,
      targetId,
      targetName,
      details,
    },
  });
}

export const ACTIONS = {
  DEVICE_TURNED_ON: 'DEVICE_TURNED_ON',
  DEVICE_TURNED_OFF: 'DEVICE_TURNED_OFF',
  DEVICE_PULSED: 'DEVICE_PULSED',
  RIEGO_PHASE_STARTED: 'RIEGO_PHASE_STARTED',
  RIEGO_PHASE_STOPPED: 'RIEGO_PHASE_STOPPED',
  RIEGO_PLAN_CREATED: 'RIEGO_PLAN_CREATED',
  RIEGO_PLAN_UPDATED: 'RIEGO_PLAN_UPDATED',
  RIEGO_PLAN_DELETED: 'RIEGO_PLAN_DELETED',
  RIEGO_PLAN_TRIGGERED: 'RIEGO_PLAN_TRIGGERED',
};
