// Read API for the pulse flow sensors (Agua module).
//
// Litres are derived here, never stored: SUM("pulsesDelta") / pulsesPerLitre.
// Recalibrating the sensor in shelly.json therefore recomputes the whole
// history instead of leaving a step in it.
//
// All day/hour buckets are Europe/Madrid natural days. Prisma stores DateTime
// as `timestamp` (naive UTC), so every bucket expression converts explicitly
// (`... AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Madrid'`) and the result is
// converted back to an instant. That keeps the answer correct regardless of
// the database server's own timezone.

import { Router } from 'express';
import { prisma } from '../config/passport.js';
import { authenticateToken } from '../middleware/auth.js';
import { getSensorDevices } from '../services/shelly.js';
import { getFlowStatus, FLOW_FRESHNESS_MS } from '../services/flowStatus.js';

const router = Router();

const TZ = 'Europe/Madrid';
const LOCAL = (col) => `(${col} AT TIME ZONE 'UTC' AT TIME ZONE '${TZ}')`;

// Whitelisted ranges — the bucket/step/window strings are interpolated into
// SQL, so they must never come from the request itself.
const RANGES = {
  '24h': {
    window: '24 hours',
    step: '5 minutes',
    bucket: (col) => `date_trunc('hour', ${col}) + INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM ${col}) / 5)`,
  },
  '7d': {
    window: '7 days',
    step: '1 hour',
    bucket: (col) => `date_trunc('hour', ${col})`,
  },
  '30d': {
    window: '30 days',
    step: '1 day',
    bucket: (col) => `date_trunc('day', ${col})`,
  },
};

function findSensor(sensorId) {
  return getSensorDevices().find(s => s.id === sensorId) || null;
}

// GET /api/flow/sensors — declared sensors with their current status
router.get('/sensors', authenticateToken, async (req, res) => {
  try {
    const sensors = getSensorDevices();

    const result = await Promise.all(sensors.map(async (sensor) => {
      const pulsesPerLitre = sensor.sensor?.pulsesPerLitre || 0;
      const cached = getFlowStatus(sensor.id);

      const [latest, latestOnline, todayRows] = await Promise.all([
        prisma.flowReading.findFirst({
          where: { sensorId: sensor.id },
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true, online: true },
        }),
        prisma.flowReading.findFirst({
          where: { sensorId: sensor.id, online: true },
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true, freqHz: true },
        }),
        prisma.$queryRawUnsafe(
          `SELECT COALESCE(SUM("pulsesDelta"), 0)::int AS pulses
             FROM "FlowReading"
            WHERE "sensorId" = $1
              AND timestamp >= (date_trunc('day', NOW() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}') AT TIME ZONE 'UTC'`,
          sensor.id
        ),
      ]);

      // A sensor whose last row is older than the freshness window stopped
      // reporting: report it offline rather than showing a frozen rate.
      const fresh = latest ? Date.now() - new Date(latest.timestamp).getTime() < FLOW_FRESHNESS_MS : false;
      const online = Boolean(latest?.online && fresh);

      let rateLpm = cached?.rateLpm ?? null;
      if (rateLpm == null && online && latestOnline?.freqHz != null && pulsesPerLitre > 0) {
        rateLpm = Math.round((latestOnline.freqHz * 60 / pulsesPerLitre) * 100) / 100;
      }
      if (!online) rateLpm = null;

      const todayPulses = todayRows?.[0]?.pulses ?? 0;
      const todayLitres = pulsesPerLitre > 0
        ? Math.round((todayPulses / pulsesPerLitre) * 10) / 10
        : null;

      return {
        id: sensor.id,
        name: sensor.name,
        room: sensor.room,
        group: sensor.group,
        showOnHome: sensor.showOnHome,
        pulsesPerLitre,
        online,
        rateLpm,
        todayLitres,
        lastReadingAt: latestOnline?.timestamp ?? null,
      };
    }));

    res.json(result);
  } catch (err) {
    console.error('Flow sensors error:', err.message);
    res.status(500).json({ error: 'Failed to fetch flow sensors' });
  }
});

// GET /api/flow/:sensorId/history?range=24h|7d|30d — litres per interval
router.get('/:sensorId/history', authenticateToken, async (req, res) => {
  const { sensorId } = req.params;
  const range = String(req.query.range || '24h');
  const spec = RANGES[range];

  if (!spec) {
    return res.status(400).json({ error: 'range must be one of 24h, 7d, 30d' });
  }

  const sensor = findSensor(sensorId);
  if (!sensor) {
    return res.status(404).json({ error: 'Sensor not found' });
  }

  try {
    const readingBucket = spec.bucket(LOCAL('r.timestamp'));
    const startBucket = spec.bucket(`(p.now_local - INTERVAL '${spec.window}')`);
    const endBucket = spec.bucket('p.now_local');

    const rows = await prisma.$queryRawUnsafe(
      `WITH p AS (SELECT (NOW() AT TIME ZONE '${TZ}') AS now_local),
       agg AS (
         SELECT ${readingBucket} AS bucket,
                SUM(r."pulsesDelta")::int AS pulses,
                AVG(r."freqHz") AS freq
           FROM "FlowReading" r, p
          WHERE r."sensorId" = $1
            AND r.timestamp >= ((p.now_local - INTERVAL '${spec.window}') AT TIME ZONE '${TZ}') AT TIME ZONE 'UTC'
          GROUP BY 1
       ),
       series AS (
         SELECT gs AS bucket
           FROM p, generate_series(${startBucket}, ${endBucket}, INTERVAL '${spec.step}') AS gs
       )
       SELECT (s.bucket AT TIME ZONE '${TZ}') AS time,
              CASE WHEN a.pulses IS NULL THEN NULL
                   ELSE ROUND(a.pulses::numeric / NULLIF($2::numeric, 0), 2)::float END AS litres,
              CASE WHEN a.freq IS NULL THEN NULL
                   ELSE ROUND((a.freq * 60)::numeric / NULLIF($2::numeric, 0), 2)::float END AS "avgRateLpm"
         FROM series s
         LEFT JOIN agg a ON a.bucket = s.bucket
        ORDER BY s.bucket`,
      sensorId,
      sensor.sensor?.pulsesPerLitre || 0
    );

    res.json(rows);
  } catch (err) {
    console.error('Flow history error:', err.message);
    res.status(500).json({ error: 'Failed to fetch flow history' });
  }
});

// GET /api/flow/:sensorId/daily?days=30 — litres per natural day (Europe/Madrid)
router.get('/:sensorId/daily', authenticateToken, async (req, res) => {
  const { sensorId } = req.params;
  const parsedDays = parseInt(req.query.days, 10);
  const days = Number.isFinite(parsedDays) ? Math.min(Math.max(parsedDays, 1), 365) : 30;

  const sensor = findSensor(sensorId);
  if (!sensor) {
    return res.status(404).json({ error: 'Sensor not found' });
  }

  try {
    const rows = await prisma.$queryRawUnsafe(
      `WITH p AS (SELECT date_trunc('day', NOW() AT TIME ZONE '${TZ}') AS today_local),
       agg AS (
         SELECT date_trunc('day', ${LOCAL('r.timestamp')}) AS bucket,
                SUM(r."pulsesDelta")::int AS pulses
           FROM "FlowReading" r, p
          WHERE r."sensorId" = $1
            AND r.timestamp >= ((p.today_local - ($2::int - 1) * INTERVAL '1 day') AT TIME ZONE '${TZ}') AT TIME ZONE 'UTC'
          GROUP BY 1
       ),
       series AS (
         SELECT gs AS bucket
           FROM p, generate_series(
             p.today_local - ($2::int - 1) * INTERVAL '1 day',
             p.today_local,
             INTERVAL '1 day'
           ) AS gs
       )
       SELECT to_char(s.bucket, 'YYYY-MM-DD') AS date,
              (s.bucket AT TIME ZONE '${TZ}') AS time,
              CASE WHEN a.pulses IS NULL THEN NULL
                   ELSE ROUND(a.pulses::numeric / NULLIF($3::numeric, 0), 1)::float END AS litres
         FROM series s
         LEFT JOIN agg a ON a.bucket = s.bucket
        ORDER BY s.bucket`,
      sensorId,
      days,
      sensor.sensor?.pulsesPerLitre || 0
    );

    res.json(rows);
  } catch (err) {
    console.error('Flow daily error:', err.message);
    res.status(500).json({ error: 'Failed to fetch flow daily totals' });
  }
});

export default router;
