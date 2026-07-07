import express from 'express';
import { getTimes } from 'suncalc';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/passport.js';
import { getDeviceById } from '../services/shelly.js';
import { computeSunTime } from '../services/deviceScheduler.js';

const router = express.Router();

const ALBERITE = { lat: 42.4067, lng: -2.4381 };
const TIMEZONE = 'Europe/Madrid';
const VALID_MODES = ['fixed', 'sunrise', 'sunset'];

function getLocalTime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  return parts;
}

function formatSunTime(type) {
  const times = getTimes(new Date(), ALBERITE.lat, ALBERITE.lng);
  const date = type === 'sunrise' ? times.sunrise : times.sunset;
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function resolveTime(mode, fixedTime) {
  if (mode === 'sunrise') return computeSunTime('sunrise');
  if (mode === 'sunset') return computeSunTime('sunset');
  return fixedTime;
}

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
    const { name, activationTime, deactivationTime, activationMode, deactivationMode } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const actMode = activationMode || 'fixed';
    const deactMode = deactivationMode || 'fixed';

    if (!VALID_MODES.includes(actMode)) {
      return res.status(400).json({ error: `Invalid activationMode: ${actMode}` });
    }
    if (!VALID_MODES.includes(deactMode)) {
      return res.status(400).json({ error: `Invalid deactivationMode: ${deactMode}` });
    }

    if (actMode === 'fixed' && !activationTime) {
      return res.status(400).json({ error: 'activationTime is required for fixed mode' });
    }
    if (deactMode === 'fixed' && !deactivationTime) {
      return res.status(400).json({ error: 'deactivationTime is required for fixed mode' });
    }

    const storedOn = actMode === 'fixed' ? activationTime : '00:00';
    const storedOff = deactMode === 'fixed' ? deactivationTime : '00:00';

    if (actMode === 'fixed' && deactMode === 'fixed' && storedOn >= storedOff) {
      return res.status(400).json({ error: 'Activation time must be before deactivation time' });
    }

    const plan = await prisma.deviceActivationPlan.create({
      data: {
        name: name.trim(),
        activationTime: storedOn,
        deactivationTime: storedOff,
        activationMode: actMode,
        deactivationMode: deactMode,
        timezone: TIMEZONE,
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
    const { name, activationTime, deactivationTime, activationMode, deactivationMode, timezone } = req.body;

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
    if (activationMode !== undefined) {
      if (!VALID_MODES.includes(activationMode)) {
        return res.status(400).json({ error: `Invalid activationMode: ${activationMode}` });
      }
      updateData.activationMode = activationMode;
    }
    if (deactivationMode !== undefined) {
      if (!VALID_MODES.includes(deactivationMode)) {
        return res.status(400).json({ error: `Invalid deactivationMode: ${deactivationMode}` });
      }
      updateData.deactivationMode = deactivationMode;
    }
    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }

    const mergedActMode = activationMode ?? existing.activationMode ?? 'fixed';
    const mergedDeactMode = deactivationMode ?? existing.deactivationMode ?? 'fixed';
    const mergedActivation = activationTime ?? existing.activationTime;
    const mergedDeactivation = deactivationTime ?? existing.deactivationTime;

    if (mergedActMode === 'fixed' && mergedDeactMode === 'fixed' && mergedActivation >= mergedDeactivation) {
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
      include: { plan: { select: { id: true, name: true, activationTime: true, deactivationTime: true, activationMode: true, deactivationMode: true } } },
    });

    const status = {};
    for (const a of activations) {
      status[a.deviceId] = {
        planId: a.planId,
        planName: a.plan.name,
        activationTime: a.plan.activationTime,
        deactivationTime: a.plan.deactivationTime,
        activationMode: a.plan.activationMode,
        deactivationMode: a.plan.deactivationMode,
      };
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
    const utcTime = getLocalTime(); // just format, we use 'Europe/Madrid'
    const sunriseTime = formatSunTime('sunrise');
    const sunsetTime = formatSunTime('sunset');

    const activations = await prisma.deviceActivation.findMany({
      include: { plan: true },
    });

    const localTime = getLocalTime();

    const records = activations.map(act => {
      const device = getDeviceById(act.deviceId);
      const actMode = act.plan.activationMode || 'fixed';
      const deactMode = act.plan.deactivationMode || 'fixed';
      const resolvedOn = resolveTime(actMode, act.plan.activationTime);
      const resolvedOff = resolveTime(deactMode, act.plan.deactivationTime);
      const matchOn = resolvedOn === localTime;
      const matchOff = resolvedOff === localTime;
      return {
        deviceId: act.deviceId,
        deviceFound: !!device,
        deviceName: device?.name || null,
        planId: act.planId,
        planName: act.plan.name,
        activationMode: actMode,
        deactivationMode: deactMode,
        activationTime: act.plan.activationTime,
        deactivationTime: act.plan.deactivationTime,
        resolvedActivationTime: resolvedOn,
        resolvedDeactivationTime: resolvedOff,
        sunriseTime,
        sunsetTime,
        localTime,
        wouldTriggerNow: matchOn || matchOff,
        wouldAction: matchOn ? 'ON' : (matchOff ? 'OFF' : null),
      };
    });

    res.json({
      serverLocalTime: localTime,
      utcTime,
      sunriseTime,
      sunsetTime,
      activationCount: activations.length,
      records,
    });
  } catch (error) {
    console.error('Error in scheduler debug:', error);
    res.status(500).json({ error: 'Failed to get scheduler debug info' });
  }
});

export default router;
