import express from 'express';
import { prisma } from '../config/passport.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all approved users (for task assignment)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isApproved: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        color: true,
        email: true,
        picture: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user scores based on completed tasks
router.get('/scores', authenticateToken, async (req, res) => {
  try {
    const { period } = req.query; // 'week', 'month', 'year', or undefined for all time

    // Point values for each size
    const sizePoints = {
      Pequena: 1,
      Mediana: 2,
      Grande: 3
    };

    // Calculate date range based on period
    let dateFilter = {};
    if (period) {
      const now = new Date();
      let startDate;

      if (period === 'week') {
        // Start of current week (Monday)
        startDate = new Date(now);
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'month') {
        // Start of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === 'year') {
        // Start of current year
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      if (startDate) {
        dateFilter = { timestamp: { gte: startDate } };
      }
    }

    // Get completion events from history within the time period
    const completionEvents = await prisma.taskHistory.findMany({
      where: {
        action: 'STATUS_CHANGED',
        newValue: 'Completada',
        ...dateFilter
      },
      select: {
        taskId: true,
        task: {
          select: {
            id: true,
            size: true,
            status: true,
            assignedToId: true
          }
        }
      }
    });

    // Get unique completed task IDs (only if task is still completed)
    const completedTaskMap = new Map();
    completionEvents.forEach(event => {
      if (event.task && event.task.assignedToId && event.task.status === 'Completada') {
        completedTaskMap.set(event.taskId, event.task);
      }
    });

    // Get all approved users
    const users = await prisma.user.findMany({
      where: { isApproved: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        color: true,
        picture: true
      }
    });

    // Calculate scores
    const scores = users.map(user => {
      const userTasks = Array.from(completedTaskMap.values()).filter(
        task => task.assignedToId === user.id
      );
      const taskCount = userTasks.length;
      const totalPoints = userTasks.reduce((sum, task) => {
        return sum + (sizePoints[task.size] || 1);
      }, 0);

      return {
        id: user.id,
        name: user.name,
        shortName: user.shortName,
        color: user.color,
        picture: user.picture,
        taskCount,
        totalPoints
      };
    });

    // Sort by total points descending
    scores.sort((a, b) => b.totalPoints - a.totalPoints);

    res.json(scores);
  } catch (error) {
    console.error('Error fetching user scores:', error);
    res.status(500).json({ error: 'Failed to fetch user scores' });
  }
});

export default router;
