// Ingestion of pulse-counter readings from a Shelly Plus Uni (input:2 in
// "count" mode), forwarded by the Raspberry Pi over the LAN.
//
// The raw counter total is stored as reported by the device, together with the
// delta since the previous reading, so aggregations downstream are a plain SUM.
// Litres are NOT stored: they are derived as pulsesDelta / pulsesPerLitre at
// read time, so recalibrating the sensor recomputes the whole history.

import { prisma } from '../config/passport.js';
import { getFlowStatus, getLastReading, updateFlowStatus } from './flowStatus.js';

const TIMEZONE = 'Europe/Madrid';

// Start of the current natural day in Europe/Madrid, expressed in the naive-UTC
// form Prisma stores DateTime in, so the comparison is correct whatever the
// database server timezone is.
const TODAY_START_SQL = `
  (date_trunc('day', NOW() AT TIME ZONE '${TIMEZONE}') AT TIME ZONE '${TIMEZONE}') AT TIME ZONE 'UTC'
`;

export function litresFrom(pulses, pulsesPerLitre) {
  if (pulses == null || !pulsesPerLitre || pulsesPerLitre <= 0) return null;
  return pulses / pulsesPerLitre;
}

async function fetchTodayLitres(sensorId, pulsesPerLitre) {
  if (!pulsesPerLitre || pulsesPerLitre <= 0) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM("pulsesDelta"), 0)::int AS pulses
       FROM "FlowReading"
      WHERE "sensorId" = $1
        AND timestamp >= ${TODAY_START_SQL}`,
    sensorId
  );
  const pulses = rows?.[0]?.pulses ?? 0;
  return pulses / pulsesPerLitre;
}

// Previous reading for the sensor: memory cache first, database on cold start.
async function findPreviousReading(sensorId) {
  const cached = getLastReading(sensorId);
  if (cached) return cached;

  const row = await prisma.flowReading.findFirst({
    where: { sensorId },
    orderBy: { timestamp: 'desc' },
    select: { pulsesTotal: true, timestamp: true },
  });
  if (!row) return null;
  return { pulsesTotal: row.pulsesTotal, timestamp: row.timestamp };
}

/**
 * Store one reading for one declared sensor device and return its summary.
 *
 * @param device  device entry from shelly.json (already resolved, kind "sensor")
 * @param entry   payload entry: { online, counts: { total }, freq }
 * @param timestamp reading time (Date)
 * @returns summary object, or null when the entry carries no usable reading
 */
export async function ingestFlowReading(device, entry, timestamp) {
  const sensorId = device.id;
  const pulsesPerLitre = Number(device.sensor?.pulsesPerLitre) || 0;
  const maxLitresPerMinute = Number(device.sensor?.maxLitresPerMinute) || 0;
  const at = timestamp instanceof Date ? timestamp : new Date(timestamp || Date.now());

  const online = entry.online !== false;
  const total = entry.counts?.total;
  const hasTotal = Number.isFinite(total) && total >= 0;

  const prev = await findPreviousReading(sensorId);

  // Unreachable device (or online but without a usable counter): store an
  // offline row so "sin conexión" is a recorded fact rather than a gap we
  // cannot tell apart from "the forwarder was down".
  if (!online || !hasTotal) {
    if (online && !hasTotal) {
      console.warn(`Flow ingestion: sensor ${sensorId} reported online without counts.total`);
    }
    await prisma.flowReading.create({
      data: {
        sensorId,
        timestamp: at,
        pulsesTotal: prev?.pulsesTotal ?? 0,
        pulsesDelta: 0,
        freqHz: null,
        counterReset: false,
        online: false,
      },
    });

    updateFlowStatus(sensorId, { online: false, rateLpm: null, todayLitres: null });

    return {
      sensorId,
      online: false,
      rateLpm: null,
      todayLitres: null,
      lastReadingAt: prev?.timestamp ? new Date(prev.timestamp).toISOString() : null,
    };
  }

  const pulsesTotal = Math.trunc(total);
  let counterReset = false;
  let pulsesDelta;

  if (!prev) {
    // First ever reading: we have no baseline, so nothing can be attributed yet.
    pulsesDelta = 0;
  } else if (pulsesTotal >= prev.pulsesTotal) {
    pulsesDelta = pulsesTotal - prev.pulsesTotal;
  } else {
    // Counter went backwards → the device rebooted or the counters were reset,
    // so the whole current total accumulated since the previous reading.
    pulsesDelta = pulsesTotal;
    counterReset = true;
  }

  const elapsedMs = prev ? at.getTime() - new Date(prev.timestamp).getTime() : 0;

  // Plausibility guard, same spirit as the inverter forwarder's bounds: a
  // physically impossible flow is a corrupted reading, and letting it into the
  // history would poison every aggregate built on top of it.
  if (pulsesDelta > 0 && elapsedMs > 0 && pulsesPerLitre > 0 && maxLitresPerMinute > 0) {
    const lpm = (pulsesDelta / pulsesPerLitre) / (elapsedMs / 60000);
    if (lpm > maxLitresPerMinute) {
      console.warn(
        `Flow ingestion: sensor ${sensorId} implausible rate ${lpm.toFixed(1)} L/min ` +
        `(max ${maxLitresPerMinute}), ${pulsesDelta} pulses in ${elapsedMs}ms — delta discarded`
      );
      pulsesDelta = 0;
    }
  }

  const freqHz = Number.isFinite(entry.freq) ? entry.freq : null;

  await prisma.flowReading.create({
    data: { sensorId, timestamp: at, pulsesTotal, pulsesDelta, freqHz, counterReset, online: true },
  });

  let rateLpm = null;
  if (freqHz != null && pulsesPerLitre > 0) {
    rateLpm = (freqHz * 60) / pulsesPerLitre;
  } else if (elapsedMs > 0 && pulsesPerLitre > 0) {
    rateLpm = (pulsesDelta / pulsesPerLitre) / (elapsedMs / 60000);
  }
  if (rateLpm != null) {
    rateLpm = Math.round(rateLpm * 100) / 100;
  }

  let todayLitres = null;
  try {
    todayLitres = await fetchTodayLitres(sensorId, pulsesPerLitre);
    if (todayLitres != null) todayLitres = Math.round(todayLitres * 10) / 10;
  } catch (err) {
    // A failed aggregate must not lose the reading we just stored.
    console.error(`Flow ingestion: today total failed for ${sensorId}:`, err.message);
    todayLitres = getFlowStatus(sensorId)?.todayLitres ?? null;
  }

  updateFlowStatus(sensorId, {
    online: true,
    pulsesTotal,
    lastReadingAt: at.toISOString(),
    freqHz,
    rateLpm,
    todayLitres,
  });

  return {
    sensorId,
    online: true,
    rateLpm,
    todayLitres,
    lastReadingAt: at.toISOString(),
    counterReset,
    pulsesDelta,
  };
}
