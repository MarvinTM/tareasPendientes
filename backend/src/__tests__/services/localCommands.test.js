import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import {
  isLocalControlAvailable,
  sendLocalCommand,
  waitForCommands,
  completeCommand,
  _reset,
} from '../../services/localCommands.js';

function fakePoll() {
  const req = new EventEmitter();
  const res = { json: jest.fn() };
  return { req, res };
}

describe('localCommands', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    _reset();
  });

  afterEach(() => {
    _reset();
    jest.useRealTimers();
  });

  it('is unavailable until the local component polls', () => {
    expect(isLocalControlAvailable()).toBe(false);
    const { req, res } = fakePoll();
    waitForCommands(req, res, 25000);
    expect(isLocalControlAvailable()).toBe(true);
  });

  it('stays available briefly between polls, then expires', () => {
    const { req, res } = fakePoll();
    waitForCommands(req, res, 25000);
    req.emit('close');
    expect(isLocalControlAvailable()).toBe(true);
    jest.advanceTimersByTime(6000);
    expect(isLocalControlAvailable()).toBe(false);
  });

  it('answers a held poll with a queued command and resolves on result', async () => {
    const { req, res } = fakePoll();
    waitForCommands(req, res, 25000);

    const pending = sendLocalCommand({ shellyId: 'abc', channel: 1, action: 'on' });

    expect(res.json).toHaveBeenCalledTimes(1);
    const { commands } = res.json.mock.calls[0][0];
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ shellyId: 'abc', channel: 1, action: 'on' });

    expect(completeCommand(commands[0].id, { ok: true, on: true })).toBe(true);
    await expect(pending).resolves.toEqual({ delivered: true, ok: true, on: true, error: null });
  });

  it('delivers a command queued before the next poll arrives', async () => {
    const pending = sendLocalCommand({ shellyId: 'abc', channel: 0, action: 'pulse' });

    const { req, res } = fakePoll();
    waitForCommands(req, res, 25000);
    const { commands } = res.json.mock.calls[0][0];
    completeCommand(commands[0].id, { ok: true });

    await expect(pending).resolves.toMatchObject({ delivered: true, ok: true });
  });

  it('reports not delivered when no poll picks the command up', async () => {
    const pending = sendLocalCommand({ shellyId: 'abc', channel: 0, action: 'pulse' });
    jest.advanceTimersByTime(3000);
    await expect(pending).resolves.toMatchObject({ delivered: false, ok: false });
  });

  it('reports delivered but failed when no result comes back', async () => {
    const { req, res } = fakePoll();
    waitForCommands(req, res, 25000);
    const pending = sendLocalCommand({ shellyId: 'abc', channel: 0, action: 'pulse' });
    jest.advanceTimersByTime(8000);
    await expect(pending).resolves.toMatchObject({ delivered: true, ok: false });
  });

  it('does not answer a poll whose connection closed', async () => {
    const { req, res } = fakePoll();
    waitForCommands(req, res, 25000);
    req.emit('close');

    const pending = sendLocalCommand({ shellyId: 'abc', channel: 0, action: 'on' });
    expect(res.json).not.toHaveBeenCalled();
    jest.advanceTimersByTime(3000);
    await expect(pending).resolves.toMatchObject({ delivered: false });
  });

  it('answers an idle poll with no commands after the wait', () => {
    const { req, res } = fakePoll();
    waitForCommands(req, res, 25000);
    jest.advanceTimersByTime(25000);
    expect(res.json).toHaveBeenCalledWith({ commands: [] });
  });

  it('releases an older poll when a newer one arrives', () => {
    const first = fakePoll();
    waitForCommands(first.req, first.res, 25000);
    const second = fakePoll();
    waitForCommands(second.req, second.res, 25000);

    expect(first.res.json).toHaveBeenCalledWith({ commands: [] });
    sendLocalCommand({ shellyId: 'abc', channel: 0, action: 'off' });
    expect(second.res.json.mock.calls[0][0].commands).toHaveLength(1);
  });

  it('ignores results for unknown commands', () => {
    expect(completeCommand('nope', { ok: true })).toBe(false);
  });
});
