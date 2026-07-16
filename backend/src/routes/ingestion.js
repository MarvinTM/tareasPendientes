import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { authenticateToken } from '../middleware/auth.js';
import { emitInverterData, emitDeviceUpdate } from '../socket.js';
import { updateShellyStatus } from '../services/shellyLocalStatus.js';
import { loadConfig } from '../services/shelly.js';

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

// POST /api/ingestion/device — receive Shelly device statuses from local component (API key auth)
router.post('/device', apiKeyAuth, async (req, res) => {
  try {
    const { devices } = req.body;

    if (!Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({ error: 'devices must be a non-empty array' });
    }

    let config;
    try {
      config = loadConfig();
    } catch (configErr) {
      console.error('Device ingestion: cannot load shelly config:', configErr.message);
      return res.status(200).json({ stored: 0, warned: 'shelly config unavailable' });
    }

    updateShellyStatus(devices);

    for (const entry of devices) {
      const shellyId = entry.shellyId;
      const online = entry.online ?? false;
      const relays = entry.relays ?? [];

      let channelIndex = 0;
      for (const relay of relays) {
        const ch = channelIndex++;
        const devConfig = config.devices.find(d => (d.shellyId || d.id) === shellyId && (d.channel ?? 0) === ch);
        if (devConfig) {
          emitDeviceUpdate({
            id: devConfig.id,
            on: relay?.on ?? null,
            online,
            source: 'local',
          });
        }
      }
    }

    res.status(200).json({ stored: devices.length });
  } catch (err) {
    console.error('Device ingestion error:', err.message);
    res.status(500).json({ error: 'Failed to process device status' });
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

// GET /api/ingestion/today — 5-min aggregated intervals for chart (JWT auth)
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      WITH combined AS (
        SELECT
          timestamp,
          SUM("pvPower")                         AS solar,
          SUM("activePower")                      AS total_ac,
          MAX(CASE WHEN "inverterId" = 'master' THEN "meterPower" END) AS meter,
          MAX(CASE WHEN "inverterId" = 'master' THEN "battPower" END)  AS batt_pwr,
          MAX(CASE WHEN "inverterId" = 'master' THEN "battSoc" END)    AS batt_soc
        FROM "InverterReading"
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY timestamp
      )
      SELECT
        date_trunc('day', timestamp)
          + INTERVAL '5 min' * FLOOR(EXTRACT(EPOCH FROM (timestamp - date_trunc('day', timestamp))) / 300)
          AS time,
        ROUND(AVG(solar))::int                  AS "solarProduction",
        -- houseConsumption = solar + batt - meter. Only computable when the
        -- master meter reading is present; otherwise NULL so the chart shows
        -- a gap rather than a misleading 0 (degraded reads must not be
        -- rendered as a sudden 0-W spike).
        CASE WHEN AVG(meter) IS NULL THEN NULL
             ELSE GREATEST(0, ROUND(AVG(solar + COALESCE(batt_pwr, 0) - meter)))::int
        END AS "houseConsumption",
        ROUND(AVG(batt_pwr))::int                AS "batteryPower",
        ROUND(AVG(batt_soc)::numeric, 1)::float  AS "batterySoc",
        ROUND(AVG(meter))::int                   AS "gridPower"
      FROM combined
      GROUP BY 1
      ORDER BY 1
    `);

    res.json(rows);
  } catch (err) {
    console.error('Today query error:', err.message);
    res.status(500).json({ error: 'Failed to fetch today data' });
  }
});

// GET /api/ingestion/today/raw — all individual readings, latest first (JWT auth)
router.get('/today/raw', authenticateToken, async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        timestamp AS time,
        SUM("pvPower")::int AS "solarProduction",
        CASE
          WHEN MAX(CASE WHEN "inverterId" = 'master' THEN "meterPower" END) IS NULL THEN NULL
          ELSE GREATEST(0,
            COALESCE(SUM("pvPower"), 0)
            + COALESCE(MAX(CASE WHEN "inverterId" = 'master' THEN "battPower" END), 0)
            - MAX(CASE WHEN "inverterId" = 'master' THEN "meterPower" END)
          )::int
        END AS "houseConsumption",
        MAX(CASE WHEN "inverterId" = 'master' THEN "battPower" END)::int   AS "batteryPower",
        MAX(CASE WHEN "inverterId" = 'master' THEN "battSoc" END)::float  AS "batterySoc",
        MAX(CASE WHEN "inverterId" = 'master' THEN "meterPower" END)::int AS "gridPower"
      FROM "InverterReading"
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY timestamp
      ORDER BY timestamp DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Raw query error:', err.message);
    res.status(500).json({ error: 'Failed to fetch raw data' });
  }
});

export default router;
