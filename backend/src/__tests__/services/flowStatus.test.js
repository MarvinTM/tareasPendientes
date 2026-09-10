import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { updateFlowStatus, getFlowStatus, getLastReading, _reset } from '../../services/flowStatus.js';

describe('Flow status cache', () => {
  beforeEach(() => {
    _reset();
  });

  it('returns null for an unknown sensor', () => {
    expect(getFlowStatus('nope')).toBeNull();
    expect(getLastReading('nope')).toBeNull();
  });

  it('stores and returns the current status', () => {
    updateFlowStatus('s1', {
      online: true,
      pulsesTotal: 1000,
      lastReadingAt: '2026-09-10T10:00:00.000Z',
      rateLpm: 12.5,
      todayLitres: 340,
    });

    expect(getFlowStatus('s1')).toEqual({
      online: true,
      rateLpm: 12.5,
      todayLitres: 340,
      lastReadingAt: '2026-09-10T10:00:00.000Z',
    });
  });

  it('expires the status once it is older than the freshness window', () => {
    updateFlowStatus('s1', { online: true, pulsesTotal: 10, lastReadingAt: 'x', rateLpm: 1 });

    expect(getFlowStatus('s1', 0)).toBeNull();
    expect(getFlowStatus('s1', 60000)).not.toBeNull();
  });

  it('keeps the counter baseline regardless of freshness', () => {
    updateFlowStatus('s1', {
      online: true,
      pulsesTotal: 1000,
      lastReadingAt: '2026-09-10T10:00:00.000Z',
    });

    expect(getLastReading('s1')).toEqual({
      pulsesTotal: 1000,
      timestamp: '2026-09-10T10:00:00.000Z',
    });
  });

  it('an offline update keeps the previous baseline but clears the rate', () => {
    updateFlowStatus('s1', {
      online: true,
      pulsesTotal: 1000,
      lastReadingAt: '2026-09-10T10:00:00.000Z',
      rateLpm: 12.5,
      todayLitres: 340,
    });
    updateFlowStatus('s1', { online: false, rateLpm: null, todayLitres: null });

    expect(getFlowStatus('s1')).toEqual({
      online: false,
      rateLpm: null,
      todayLitres: null,
      lastReadingAt: '2026-09-10T10:00:00.000Z',
    });
    expect(getLastReading('s1')).toEqual({
      pulsesTotal: 1000,
      timestamp: '2026-09-10T10:00:00.000Z',
    });
  });

  it('ignores a baseline without a total or a timestamp', () => {
    updateFlowStatus('s1', { online: false });

    expect(getLastReading('s1')).toBeNull();
  });
});
