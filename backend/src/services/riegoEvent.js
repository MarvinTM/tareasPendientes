import { prisma } from '../config/passport.js';

export async function logRiegoEvent(event, phaseId, phaseName, { stopReason, error, userId, details } = {}) {
  return prisma.riegoEvent.create({
    data: {
      event,
      phaseId,
      phaseName,
      stopReason: stopReason || null,
      error: error || null,
      userId: userId || null,
      details: details || null,
    },
  });
}
