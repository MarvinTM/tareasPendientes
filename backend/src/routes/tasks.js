import express from 'express';
import { prisma } from '../config/passport.js';
import { authenticateToken } from '../middleware/auth.js';
import { logTaskChange, ACTIONS } from '../services/taskHistory.js';
import { emitTaskUpdate } from '../socket.js';

const router = express.Router();

// Get all tasks
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        createdBy: {
          select: { id: true, name: true, picture: true }
        },
        assignedTo: {
          select: { id: true, name: true, picture: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group by status
    const grouped = {
      Nueva: tasks.filter(t => t.status === 'Nueva'),
      EnProgreso: tasks.filter(t => t.status === 'EnProgreso'),
      Completada: tasks.filter(t => t.status === 'Completada')
    };

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        createdById: req.user.id
      },
      include: {
        createdBy: {
          select: { id: true, name: true, picture: true }
        },
        assignedTo: {
          select: { id: true, name: true, picture: true }
        }
      }
    });

    // Log creation
    await logTaskChange(task.id, req.user.id, ACTIONS.CREATED, null, title);

    // Emit real-time update
    emitTaskUpdate('task:created', task);

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, size, assignedToId } = req.body;

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, name: true }
        }
      }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updateData = {};

    // Track changes
    if (title !== undefined && title.trim() !== existingTask.title) {
      updateData.title = title.trim();
      await logTaskChange(id, req.user.id, ACTIONS.TITLE_UPDATED, existingTask.title, title.trim());
    }

    if (description !== undefined && description !== existingTask.description) {
      updateData.description = description?.trim() || null;
      await logTaskChange(id, req.user.id, ACTIONS.DESCRIPTION_UPDATED, existingTask.description, description?.trim() || null);
    }

    if (status !== undefined && status !== existingTask.status) {
      if (!['Nueva', 'EnProgreso', 'Completada'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updateData.status = status;

      // Set or clear completedAt based on status
      if (status === 'Completada') {
        updateData.completedAt = new Date();
      } else if (existingTask.status === 'Completada') {
        updateData.completedAt = null;
      }

      await logTaskChange(id, req.user.id, ACTIONS.STATUS_CHANGED, existingTask.status, status);
    }

    if (size !== undefined && size !== existingTask.size) {
      if (!['Pequena', 'Mediana', 'Grande'].includes(size)) {
        return res.status(400).json({ error: 'Invalid size' });
      }
      updateData.size = size;
      await logTaskChange(id, req.user.id, ACTIONS.SIZE_CHANGED, existingTask.size, size);
    }

    if (assignedToId !== undefined && assignedToId !== existingTask.assignedToId) {
      if (assignedToId !== null) {
        // Verify the user exists and is approved
        const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
        if (!assignee || !assignee.isApproved) {
          return res.status(400).json({ error: 'Invalid assignee' });
        }
        updateData.assignedToId = assignedToId;
        await logTaskChange(id, req.user.id, ACTIONS.ASSIGNED, existingTask.assignedTo?.name || null, assignee.name);
      } else {
        updateData.assignedToId = null;
        await logTaskChange(id, req.user.id, ACTIONS.UNASSIGNED, existingTask.assignedTo?.name || null, null);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.json(existingTask);
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, picture: true }
        },
        assignedTo: {
          select: { id: true, name: true, picture: true }
        }
      }
    });

    // Emit real-time update
    emitTaskUpdate('task:updated', task);

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existingTask = await prisma.task.findUnique({ where: { id } });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Log deletion before deleting
    await logTaskChange(id, req.user.id, ACTIONS.DELETED, existingTask.title, null);

    await prisma.task.delete({ where: { id } });

    // Emit real-time update
    emitTaskUpdate('task:deleted', { id });

    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Get task history
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const history = await prisma.taskHistory.findMany({
      where: { taskId: id },
      include: {
        user: {
          select: { id: true, name: true, picture: true }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    res.json(history);
  } catch (error) {
    console.error('Error fetching task history:', error);
    res.status(500).json({ error: 'Failed to fetch task history' });
  }
});

export default router;
