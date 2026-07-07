import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/passport.js';
import { getDeviceById } from '../services/shelly.js';

const router = express.Router();

router.get('/activation-plans', authenticateToken, async (req, res) => {
  try {
    const plans = await prisma.deviceActivationPlan.findMany({
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching activation plans:', error);
    res.status(500).json({ error: 'Failed to fetch activation plans' });
  }
});

router.post('/activation-plans', authenticateToken, async (req, res) => {
  try {
    const { name, activationTime, deactivationTime } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!activationTime || !deactivationTime) {
      return res.status(400).json({ error: 'Both activation and deactivation times are required' });
    }
    if (activationTime >= deactivationTime) {
      return res.status(400).json({ error: 'Activation time must be before deactivation time' });
    }

    const plan = await prisma.deviceActivationPlan.create({
      data: {
        name: name.trim(),
        activationTime,
        deactivationTime,
        createdById: req.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating activation plan:', error);
    res.status(500).json({ error: 'Failed to create activation plan' });
  }
});

router.patch('/activation-plans/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, activationTime, deactivationTime } = req.body;

    const existing = await prisma.deviceActivationPlan.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const updateData = {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Name is required' });
      updateData.name = name.trim();
    }
    if (activationTime !== undefined) updateData.activationTime = activationTime;
    if (deactivationTime !== undefined) updateData.deactivationTime = deactivationTime;

    const mergedActivation = activationTime ?? existing.activationTime;
    const mergedDeactivation = deactivationTime ?? existing.deactivationTime;
    if (mergedActivation >= mergedDeactivation) {
      return res.status(400).json({ error: 'Activation time must be before deactivation time' });
    }

    const plan = await prisma.deviceActivationPlan.update({
      where: { id },
      data: updateData,
      include: { createdBy: { select: { id: true, name: true } } },
    });

    res.json(plan);
  } catch (error) {
    console.error('Error updating activation plan:', error);
    res.status(500).json({ error: 'Failed to update activation plan' });
  }
});

router.delete('/activation-plans/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.deviceActivationPlan.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    await prisma.deviceActivationPlan.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting activation plan:', error);
    res.status(500).json({ error: 'Failed to delete activation plan' });
  }
});

router.get('/activation-status', authenticateToken, async (req, res) => {
  try {
    const activations = await prisma.deviceActivation.findMany({
      include: { plan: { select: { id: true, name: true } } },
    });

    const status = {};
    for (const a of activations) {
      status[a.deviceId] = { planId: a.planId, planName: a.plan.name };
    }

    res.json(status);
  } catch (error) {
    console.error('Error fetching activation status:', error);
    res.status(500).json({ error: 'Failed to fetch activation status' });
  }
});

router.post('/:deviceId/activation', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    const plan = await prisma.deviceActivationPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const activation = await prisma.deviceActivation.upsert({
      where: { deviceId },
      update: { planId },
      create: { deviceId, planId },
      include: { plan: { select: { id: true, name: true } } },
    });

    res.json(activation);
  } catch (error) {
    console.error('Error assigning activation plan:', error);
    res.status(500).json({ error: 'Failed to assign activation plan' });
  }
});

router.delete('/:deviceId/activation', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const existing = await prisma.deviceActivation.findUnique({ where: { deviceId } });
    if (!existing) {
      return res.status(404).json({ error: 'No activation assigned to this device' });
    }

    await prisma.deviceActivation.delete({ where: { deviceId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing activation:', error);
    res.status(500).json({ error: 'Failed to remove activation' });
  }
});

router.get('/scheduler-debug', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${h}:${m}`;

    const activations = await prisma.deviceActivation.findMany({
      include: { plan: true },
    });

    const records = activations.map(act => {
      const device = getDeviceById(act.deviceId);
      const matchOn = act.plan.activationTime === currentTime;
      const matchOff = act.plan.deactivationTime === currentTime;
      return {
        deviceId: act.deviceId,
        deviceFound: !!device,
        deviceName: device?.name || null,
        planId: act.planId,
        planName: act.plan.name,
        activationTime: act.plan.activationTime,
        deactivationTime: act.plan.deactivationTime,
        wouldTriggerNow: matchOn || matchOff,
        wouldAction: matchOn ? 'ON' : (matchOff ? 'OFF' : null),
      };
    });

    res.json({
      serverTime: currentTime,
      serverTimezoneOffset: now.getTimezoneOffset(),
      activationCount: activations.length,
      records,
    });
  } catch (error) {
    console.error('Error in scheduler debug:', error);
    res.status(500).json({ error: 'Failed to get scheduler debug info' });
  }
});

export default router;
