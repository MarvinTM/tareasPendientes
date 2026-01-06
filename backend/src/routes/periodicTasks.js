import express from 'express';
import { prisma } from '../config/passport.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all periodic tasks
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tasks = await prisma.periodicTask.findMany({
      include: {
        category: {
          select: { id: true, name: true, emoji: true }
        },
        assignedTo: {
          select: { id: true, name: true, shortName: true, color: true, picture: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching periodic tasks:', error);
    res.status(500).json({ error: 'Failed to fetch periodic tasks' });
  }
});

// Create periodic task
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      size,
      frequency,
      dayOfWeek,
      monthOfYear,
      categoryId,
      assignedToId,
      activeFromMonth,
      activeToMonth
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!['WEEKLY', 'MONTHLY'].includes(frequency)) {
      return res.status(400).json({ error: 'Valid frequency is required' });
    }

    if (frequency === 'WEEKLY' && (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6)) {
      return res.status(400).json({ error: 'Valid day of week (0-6) is required for weekly tasks' });
    }

    if (frequency === 'MONTHLY' && (monthOfYear === undefined || monthOfYear < 0 || monthOfYear > 11)) {
      return res.status(400).json({ error: 'Valid month (0-11) is required for monthly tasks' });
    }

    // Validate activeFromMonth and activeToMonth (only for WEEKLY tasks)
    if (frequency === 'WEEKLY') {
      if (activeFromMonth !== undefined && activeFromMonth !== null && (activeFromMonth < 0 || activeFromMonth > 11)) {
        return res.status(400).json({ error: 'Valid activeFromMonth (0-11) is required' });
      }
      if (activeToMonth !== undefined && activeToMonth !== null && (activeToMonth < 0 || activeToMonth > 11)) {
        return res.status(400).json({ error: 'Valid activeToMonth (0-11) is required' });
      }
    }

    // Validate category
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const task = await prisma.periodicTask.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        size: size || 'Pequena',
        frequency,
        dayOfWeek: frequency === 'WEEKLY' ? dayOfWeek : null,
        monthOfYear: frequency === 'MONTHLY' ? monthOfYear : null,
        activeFromMonth: frequency === 'WEEKLY' ? (activeFromMonth ?? null) : null,
        activeToMonth: frequency === 'WEEKLY' ? (activeToMonth ?? null) : null,
        categoryId,
        assignedToId: assignedToId || null
      },
      include: {
        category: true,
        assignedTo: {
          select: { id: true, name: true, shortName: true, color: true, picture: true }
        }
      }
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating periodic task:', error);
    res.status(500).json({ error: 'Failed to create periodic task' });
  }
});

// Update periodic task
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      size,
      frequency,
      dayOfWeek,
      monthOfYear,
      categoryId,
      assignedToId,
      activeFromMonth,
      activeToMonth
    } = req.body;

    const task = await prisma.periodicTask.update({
      where: { id },
      data: {
        title: title?.trim(),
        description: description?.trim(),
        size,
        frequency,
        dayOfWeek: frequency === 'WEEKLY' ? dayOfWeek : null,
        monthOfYear: frequency === 'MONTHLY' ? monthOfYear : null,
        activeFromMonth: frequency === 'WEEKLY' ? (activeFromMonth ?? null) : null,
        activeToMonth: frequency === 'WEEKLY' ? (activeToMonth ?? null) : null,
        categoryId,
        assignedToId: assignedToId || null
      },
      include: {
        category: true,
        assignedTo: {
          select: { id: true, name: true, shortName: true, color: true, picture: true }
        }
      }
    });

    res.json(task);
  } catch (error) {
    console.error('Error updating periodic task:', error);
    res.status(500).json({ error: 'Failed to update periodic task' });
  }
});

// Delete periodic task
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deletePending = req.query.deletePending === 'true';

    // Transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // 1. If requested, delete pending tasks generated by this routine
      if (deletePending) {
        // Find tasks to log deletion (optional, but good for auditing)
        // For simplicity, we just delete them.
        const tasksToDelete = await tx.task.findMany({
          where: {
            periodicTaskId: id,
            status: { not: 'Completada' }
          },
          select: { id: true }
        });

        if (tasksToDelete.length > 0) {
           await tx.task.deleteMany({
             where: {
               id: { in: tasksToDelete.map(t => t.id) }
             }
           });
           
           // Ideally we would emit socket events for each deleted task, 
           // but we'll rely on the client refreshing or simple event.
        }
      }

      // 2. Delete the periodic task itself
      await tx.periodicTask.delete({ where: { id } });
    });
    
    // We should emit a general update or the client should refresh
    res.json({ message: 'Periodic task deleted' });
  } catch (error) {
    console.error('Error deleting periodic task:', error);
    res.status(500).json({ error: 'Failed to delete periodic task' });
  }
});

export default router;
