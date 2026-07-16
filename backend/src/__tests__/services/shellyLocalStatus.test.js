import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('shellyLocalStatus', () => {
  beforeEach(async () => {
    jest.resetModules();
    const { _reset } = await import('../../services/shellyLocalStatus.js');
    _reset();
  });

  it('updates and retrieves status for a shellyId', async () => {
    const { updateShellyStatus, getShellyStatus } = await import('../../services/shellyLocalStatus.js');

    updateShellyStatus([
      { shellyId: 'abc123', online: true, relays: [{ on: true }, { on: false }] },
    ]);

    const status = getShellyStatus('abc123');
    expect(status.online).toBe(true);
    expect(status.relays).toEqual([{ on: true }, { on: false }]);
  });

  it('returns null for unknown shellyId', async () => {
    const { getShellyStatus } = await import('../../services/shellyLocalStatus.js');
    expect(getShellyStatus('nope')).toBeNull();
  });

  it('returns null when entry is older than maxAgeMs', async () => {
    const { updateShellyStatus, getShellyStatus } = await import('../../services/shellyLocalStatus.js');

    updateShellyStatus([
      { shellyId: 'old', online: true, relays: [{ on: true }] },
    ]);

    expect(getShellyStatus('old', 0)).toBeNull();
    expect(getShellyStatus('old', 600000)).not.toBeNull();
  });

  it('overwrites previous entry on update', async () => {
    const { updateShellyStatus, getShellyStatus } = await import('../../services/shellyLocalStatus.js');

    updateShellyStatus([
      { shellyId: 'abc', online: true, relays: [{ on: true }] },
    ]);
    updateShellyStatus([
      { shellyId: 'abc', online: false, relays: [{ on: false }] },
    ]);

    const status = getShellyStatus('abc');
    expect(status.online).toBe(false);
    expect(status.relays).toEqual([{ on: false }]);
  });

  it('markStale sets updatedAt to 0 so entry becomes stale immediately', async () => {
    const { updateShellyStatus, markStale, getShellyStatus } = await import('../../services/shellyLocalStatus.js');

    updateShellyStatus([
      { shellyId: 'abc', online: true, relays: [{ on: true }] },
    ]);

    markStale('abc');

    expect(getShellyStatus('abc', 0)).toBeNull();
    expect(getShellyStatus('abc', 30000)).toBeNull();
  });

  it('markStale does nothing for unknown shellyId', async () => {
    const { markStale } = await import('../../services/shellyLocalStatus.js');
    expect(() => markStale('nope')).not.toThrow();
  });

  it('defaults online to false and relays to empty array when missing', async () => {
    const { updateShellyStatus, getShellyStatus } = await import('../../services/shellyLocalStatus.js');

    updateShellyStatus([
      { shellyId: 'minimal' },
    ]);

    const status = getShellyStatus('minimal');
    expect(status.online).toBe(false);
    expect(status.relays).toEqual([]);
  });
});