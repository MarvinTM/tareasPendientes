import express from 'express';
import { prisma } from '../config/passport.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const before = req.query.before;
    const beforeFilter = before ? { timestamp: { lt: new Date(before) } } : undefined;

    const [taskHistory, activityLogs] = await Promise.all([
      prisma.taskHistory.findMany({
        where: beforeFilter,
        include: {
          user: {
            select: { id: true, name: true, shortName: true, color: true, picture: true },
          },
          task: {
            select: { id: true, title: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit + 1,
      }),
      prisma.activityLog.findMany({
        where: beforeFilter,
        include: {
          user: {
            select: { id: true, name: true, shortName: true, color: true, picture: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit + 1,
      }),
    ]);

    const taskEntries = taskHistory.map(h => ({
      id: h.id,
      type: 'task',
      userId: h.userId,
      user: h.user,
      action: h.action,
      taskId: h.taskId,
      task: h.task,
      previousValue: h.previousValue,
      newValue: h.newValue,
      timestamp: h.timestamp,
    }));

    const activityEntries = activityLogs.map(a => ({
      id: a.id,
      type: 'activity',
      userId: a.userId,
      user: a.user,
      action: a.action,
      targetId: a.targetId,
      targetName: a.targetName,
      details: a.details,
      timestamp: a.timestamp,
    }));

    const merged = [...taskEntries, ...activityEntries]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const hasMore = merged.length > limit;
    const entries = merged.slice(0, limit);
    const nextCursor = entries.length > 0 ? entries[entries.length - 1].timestamp : null;

    res.json({
      entries,
      nextCursor: hasMore && nextCursor ? nextCursor.toISOString() : null,
      hasMore,
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

export default router;
