import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { authenticateToken } from '../middleware/auth.js';
import { emitInverterData } from '../socket.js';

const router = Router();
const prisma = new PrismaClient();

// POST /api/ingestion/inverter — receive readings from local component (API key auth)
router.post('/inverter', apiKeyAuth, async (req, res) => {
  try {
    const { timestamp, readings } = req.body;

    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ error: 'readings must be a non-empty array' });
    }

    const stored = [];
    for (const r of readings) {
      const reading = await prisma.inverterReading.create({
        data: {
          inverterId:    r.inverterId,
          timestamp:     timestamp ? new Date(timestamp) : undefined,
          pv1Voltage:    r.pv1Voltage,
          pv1Current:    r.pv1Current,
          pv2Voltage:    r.pv2Voltage,
          pv2Current:    r.pv2Current,
          pvPower:       r.pvPower,
          activePower:   r.activePower,
          gridVoltage:   r.gridVoltage,
          meterPower:    r.meterPower,
          battSoc:       r.battSoc,
          battCurrent:   r.battCurrent,
          battVoltage:   r.battVoltage,
          battPower:     r.battPower,
          temperature:   r.temperature,
          gridPwrLimit:  r.gridPwrLimit,
          runningState:  r.runningState,
        },
      });
      stored.push(reading);
    }

    // Emit to all frontend clients
    emitInverterData(stored);

    res.status(201).json({ stored: stored.length });
  } catch (err) {
    console.error('Ingestion error:', err.message);
    res.status(500).json({ error: 'Failed to store readings' });
  }
});

// GET /api/ingestion/latest — latest reading per inverter (JWT auth, for frontend)
router.get('/latest', authenticateToken, async (req, res) => {
  try {
    // Get the latest timestamp first, then fetch all readings at that timestamp
    const latest = await prisma.inverterReading.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });

    if (!latest) {
      return res.json([]);
    }

    const readings = await prisma.inverterReading.findMany({
      where: { timestamp: latest.timestamp },
      orderBy: { inverterId: 'asc' },
    });

    res.json(readings);
  } catch (err) {
    console.error('Latest readings error:', err.message);
    res.status(500).json({ error: 'Failed to fetch readings' });
  }
});

export default router;
