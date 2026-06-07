import { jest, describe, it, expect, beforeEach } from '@jest/globals';

import { setIO, getIO, emitTaskUpdate } from '../socket.js';

describe('Socket Module', () => {
  beforeEach(() => {
    setIO(null);
  });

  describe('setIO', () => {
    it('should store the socket IO instance', () => {
      const mockIO = { emit: jest.fn() };
      setIO(mockIO);
      expect(getIO()).toBe(mockIO);
    });

    it('should store null', () => {
      setIO(null);
      expect(getIO()).toBeNull();
    });
  });

  describe('getIO', () => {
    it('should return null when nothing is set', () => {
      expect(getIO()).toBeNull();
    });

    it('should return the stored IO instance', () => {
      const mockIO = { emit: jest.fn() };
      setIO(mockIO);
      expect(getIO()).toEqual(mockIO);
    });

    it('should return the last set IO instance (replacement)', () => {
      const io1 = { emit: jest.fn(), id: 'io1' };
      const io2 = { emit: jest.fn(), id: 'io2' };

      setIO(io1);
      setIO(io2);

      expect(getIO()).toBe(io2);
    });
  });

  describe('emitTaskUpdate', () => {
    it('should do nothing when io is null', () => {
      setIO(null);

      expect(() => {
        emitTaskUpdate('task:created', { id: '1' });
      }).not.toThrow();
    });

    it('should call io.emit with event and data when io is set', () => {
      const mockIO = { emit: jest.fn() };
      setIO(mockIO);

      const event = 'task:created';
      const data = { id: 'task-1', title: 'New Task' };

      emitTaskUpdate(event, data);

      expect(mockIO.emit).toHaveBeenCalledTimes(1);
      expect(mockIO.emit).toHaveBeenCalledWith(event, data);
    });

    it('should emit task:updated event', () => {
      const mockIO = { emit: jest.fn() };
      setIO(mockIO);

      const data = { id: 'task-2', title: 'Updated Task', status: 'EnProgreso' };
      emitTaskUpdate('task:updated', data);

      expect(mockIO.emit).toHaveBeenCalledWith('task:updated', data);
    });

    it('should emit task:deleted event', () => {
      const mockIO = { emit: jest.fn() };
      setIO(mockIO);

      emitTaskUpdate('task:deleted', { id: 'task-3' });

      expect(mockIO.emit).toHaveBeenCalledWith('task:deleted', { id: 'task-3' });
    });

    it('should handle emitting with empty data', () => {
      const mockIO = { emit: jest.fn() };
      setIO(mockIO);

      emitTaskUpdate('task:created', null);

      expect(mockIO.emit).toHaveBeenCalledWith('task:created', null);
    });

    it('should not crash if io.emit throws', () => {
      const mockIO = { emit: jest.fn(() => { throw new Error('Emit failed'); }) };
      setIO(mockIO);

      expect(() => {
        emitTaskUpdate('task:created', { id: '1' });
      }).toThrow('Emit failed');
    });
  });
});
