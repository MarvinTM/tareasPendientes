import { prisma } from '../config/passport.js';

export async function logTaskChange(taskId, userId, action, previousValue = null, newValue = null) {
  return prisma.taskHistory.create({
    data: {
      taskId,
      userId,
      action,
      previousValue,
      newValue
    }
  });
}

export const ACTIONS = {
  CREATED: 'CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  SIZE_CHANGED: 'SIZE_CHANGED',
  TITLE_UPDATED: 'TITLE_UPDATED',
  DESCRIPTION_UPDATED: 'DESCRIPTION_UPDATED',
  ASSIGNED: 'ASSIGNED',
  UNASSIGNED: 'UNASSIGNED',
  DELETED: 'DELETED',
  CATEGORY_CHANGED: 'CATEGORY_CHANGED'
};
