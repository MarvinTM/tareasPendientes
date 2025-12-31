import express from 'express';
import { prisma } from '../config/passport.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all history (paginated)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      prisma.taskHistory.findMany({
        include: {
          user: {
            select: { id: true, name: true, picture: true }
          },
          task: {
            select: { id: true, title: true }
          }
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      }),
      prisma.taskHistory.count()
    ]);

    res.json({
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
