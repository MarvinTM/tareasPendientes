import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/passport.js';
import {
  getState,
  enqueue,
  dequeue,
  stopCurrent,
} from '../services/riegoQueue.js';
import { logActivity, ACTIONS } from '../services/activityLog.js';

const router = express.Router();

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const state = getState();
    res.set('Cache-Control', 'no-store');
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
    const state = getState();
    const phase = state.phases.find(p => p.id === phaseId);
    logActivity(req.user.id, ACTIONS.RIEGO_PHASE_STARTED, phaseId, phase?.name || phaseId, { durationMin: Number(durationMin) })
      .catch(err => console.error('Failed to log riego activity:', err));
    res.status(201).json({ queueId, ...state });
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
    const state = getState();
    const current = state.current;
    await stopCurrent(req.user.id);
    if (current) {
      logActivity(req.user.id, ACTIONS.RIEGO_PHASE_STOPPED, current.phaseId, current.name)
        .catch(err => console.error('Failed to log riego activity:', err));
    }
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
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
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

    logActivity(req.user.id, ACTIONS.RIEGO_PLAN_CREATED, plan.id, plan.name, { phasesCount: phases.length })
      .catch(err => console.error('Failed to log riego activity:', err));

    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating riego plan:', error);
    res.status(500).json({ error: 'Failed to create riego plan' });
  }
});

router.patch('/plans/reorder', authenticateToken, async (req, res) => {
  try {
    const { planIds } = req.body;

    if (!Array.isArray(planIds)) {
      return res.status(400).json({ error: 'planIds array is required' });
    }

    await prisma.$transaction(
      planIds.map((id, index) =>
        prisma.riegoPlan.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering riego plans:', error);
    res.status(500).json({ error: 'Failed to reorder plans' });
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

    logActivity(req.user.id, ACTIONS.RIEGO_PLAN_UPDATED, plan.id, plan.name)
      .catch(err => console.error('Failed to log riego activity:', err));

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

    logActivity(req.user.id, ACTIONS.RIEGO_PLAN_DELETED, existing.id, existing.name)
      .catch(err => console.error('Failed to log riego activity:', err));

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

    logActivity(req.user.id, ACTIONS.RIEGO_PLAN_TRIGGERED, plan.id, plan.name, { phasesCount: plan.phases.length })
      .catch(err => console.error('Failed to log riego activity:', err));

    res.status(201).json(getState());
  } catch (error) {
    console.error('Error triggering riego plan:', error);
    res.status(500).json({ error: 'Failed to trigger riego plan' });
  }
});

router.get('/events', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const before = req.query.before;
    const beforeFilter = before ? { timestamp: { lt: new Date(before) } } : undefined;

    const events = await prisma.riegoEvent.findMany({
      where: beforeFilter,
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: limit + 1,
    });

    const hasMore = events.length > limit;
    const items = events.slice(0, limit);
    const nextCursor = items.length > 0 ? items[items.length - 1].timestamp : null;

    res.json({
      events: items,
      nextCursor: hasMore && nextCursor ? nextCursor.toISOString() : null,
      hasMore,
    });
  } catch (error) {
    console.error('Error fetching riego events:', error);
    res.status(500).json({ error: 'Failed to fetch riego events' });
  }
});

export default router;
