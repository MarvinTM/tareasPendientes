import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/passport.js';
import {
  getState,
  enqueue,
  dequeue,
  stopCurrent,
} from '../services/riegoQueue.js';

const router = express.Router();

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const state = getState();
    res.json(state);
  } catch (error) {
    console.error('Error getting riego state:', error);
    res.status(500).json({ error: 'Failed to get riego state' });
  }
});

router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { phaseId, durationMin } = req.body;

    if (!phaseId) {
      return res.status(400).json({ error: 'phaseId is required' });
    }

    if (durationMin === undefined || durationMin === null) {
      return res.status(400).json({ error: 'durationMin is required' });
    }

    const queueId = enqueue(phaseId, Number(durationMin));
    res.status(201).json({ queueId, ...getState() });
  } catch (error) {
    if (error.message?.includes('Fase no encontrada') || error.message?.includes('Duración inválida')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error starting riego phase:', error);
    res.status(500).json({ error: 'Failed to start riego phase' });
  }
});

router.post('/stop', authenticateToken, async (req, res) => {
  try {
    await stopCurrent();
    res.json(getState());
  } catch (error) {
    console.error('Error stopping riego:', error);
    res.status(500).json({ error: 'Failed to stop riego' });
  }
});

router.delete('/queue/:queueId', authenticateToken, async (req, res) => {
  try {
    const { queueId } = req.params;
    const removed = dequeue(queueId);

    if (!removed) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    res.json(getState());
  } catch (error) {
    console.error('Error removing from riego queue:', error);
    res.status(500).json({ error: 'Failed to remove from queue' });
  }
});

router.get('/plans', authenticateToken, async (req, res) => {
  try {
    const plans = await prisma.riegoPlan.findMany({
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching riego plans:', error);
    res.status(500).json({ error: 'Failed to fetch riego plans' });
  }
});

router.post('/plans', authenticateToken, async (req, res) => {
  try {
    const { name, phases } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!Array.isArray(phases) || phases.length === 0) {
      return res.status(400).json({ error: 'At least one phase is required' });
    }

    for (const p of phases) {
      if (!p.phaseId || !p.durationMin || p.durationMin <= 0) {
        return res.status(400).json({ error: 'Each phase must have phaseId and valid durationMin' });
      }
    }

    const plan = await prisma.riegoPlan.create({
      data: {
        name: name.trim(),
        phases,
        createdById: req.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating riego plan:', error);
    res.status(500).json({ error: 'Failed to create riego plan' });
  }
});

router.patch('/plans/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phases } = req.body;

    const existing = await prisma.riegoPlan.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const updateData = {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Name is required' });
      updateData.name = name.trim();
    }
    if (phases !== undefined) {
      if (!Array.isArray(phases) || phases.length === 0) {
        return res.status(400).json({ error: 'At least one phase is required' });
      }
      updateData.phases = phases;
    }

    const plan = await prisma.riegoPlan.update({
      where: { id },
      data: updateData,
      include: { createdBy: { select: { id: true, name: true } } },
    });

    res.json(plan);
  } catch (error) {
    console.error('Error updating riego plan:', error);
    res.status(500).json({ error: 'Failed to update riego plan' });
  }
});

router.delete('/plans/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.riegoPlan.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    await prisma.riegoPlan.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting riego plan:', error);
    res.status(500).json({ error: 'Failed to delete riego plan' });
  }
});

router.post('/plans/:id/trigger', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await prisma.riegoPlan.findUnique({ where: { id } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    for (const p of plan.phases) {
      enqueue(p.phaseId, p.durationMin);
    }

    res.status(201).json(getState());
  } catch (error) {
    console.error('Error triggering riego plan:', error);
    res.status(500).json({ error: 'Failed to trigger riego plan' });
  }
});

export default router;
