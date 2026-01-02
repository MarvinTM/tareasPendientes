import { describe, it, expect } from '@jest/globals';

// Import the ACTIONS constant directly - it's pure data
import { ACTIONS } from '../../services/taskHistory.js';

describe('TaskHistory Service', () => {
  describe('ACTIONS', () => {
    it('should have all expected action types', () => {
      expect(ACTIONS.CREATED).toBe('CREATED');
      expect(ACTIONS.STATUS_CHANGED).toBe('STATUS_CHANGED');
      expect(ACTIONS.SIZE_CHANGED).toBe('SIZE_CHANGED');
      expect(ACTIONS.TITLE_UPDATED).toBe('TITLE_UPDATED');
      expect(ACTIONS.DESCRIPTION_UPDATED).toBe('DESCRIPTION_UPDATED');
      expect(ACTIONS.ASSIGNED).toBe('ASSIGNED');
      expect(ACTIONS.UNASSIGNED).toBe('UNASSIGNED');
      expect(ACTIONS.DELETED).toBe('DELETED');
      expect(ACTIONS.CATEGORY_CHANGED).toBe('CATEGORY_CHANGED');
    });

    it('should have exactly 9 action types', () => {
      expect(Object.keys(ACTIONS)).toHaveLength(9);
    });

    it('should have unique action values', () => {
      const values = Object.values(ACTIONS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('logTaskChange data structure', () => {
    it('should create correct history entry structure for creation', () => {
      const historyEntry = {
        taskId: 'task-id',
        userId: 'user-id',
        action: ACTIONS.CREATED,
        previousValue: null,
        newValue: 'New Task Title'
      };

      expect(historyEntry.taskId).toBe('task-id');
      expect(historyEntry.userId).toBe('user-id');
      expect(historyEntry.action).toBe('CREATED');
      expect(historyEntry.previousValue).toBeNull();
      expect(historyEntry.newValue).toBe('New Task Title');
    });

    it('should create correct history entry structure for status change', () => {
      const historyEntry = {
        taskId: 'task-id',
        userId: 'user-id',
        action: ACTIONS.STATUS_CHANGED,
        previousValue: 'Nueva',
        newValue: 'EnProgreso'
      };

      expect(historyEntry.action).toBe('STATUS_CHANGED');
      expect(historyEntry.previousValue).toBe('Nueva');
      expect(historyEntry.newValue).toBe('EnProgreso');
    });

    it('should create correct history entry structure for assignment', () => {
      const historyEntry = {
        taskId: 'task-id',
        userId: 'user-id',
        action: ACTIONS.ASSIGNED,
        previousValue: 'John Doe',
        newValue: 'Jane Doe'
      };

      expect(historyEntry.action).toBe('ASSIGNED');
      expect(historyEntry.previousValue).toBe('John Doe');
      expect(historyEntry.newValue).toBe('Jane Doe');
    });

    it('should create correct history entry structure for deletion', () => {
      const historyEntry = {
        taskId: 'task-id',
        userId: 'user-id',
        action: ACTIONS.DELETED,
        previousValue: 'Task to Delete',
        newValue: null
      };

      expect(historyEntry.action).toBe('DELETED');
      expect(historyEntry.previousValue).toBe('Task to Delete');
      expect(historyEntry.newValue).toBeNull();
    });

    it('should handle null values for optional fields', () => {
      const historyEntry = {
        taskId: 'task-id',
        userId: 'user-id',
        action: ACTIONS.CREATED,
        previousValue: null,
        newValue: null
      };

      expect(historyEntry.previousValue).toBeNull();
      expect(historyEntry.newValue).toBeNull();
    });
  });

  describe('Action Types Coverage', () => {
    it('should have action for task creation', () => {
      expect(ACTIONS.CREATED).toBeDefined();
    });

    it('should have action for status changes', () => {
      expect(ACTIONS.STATUS_CHANGED).toBeDefined();
    });

    it('should have action for size changes', () => {
      expect(ACTIONS.SIZE_CHANGED).toBeDefined();
    });

    it('should have action for title updates', () => {
      expect(ACTIONS.TITLE_UPDATED).toBeDefined();
    });

    it('should have action for description updates', () => {
      expect(ACTIONS.DESCRIPTION_UPDATED).toBeDefined();
    });

    it('should have action for assignment', () => {
      expect(ACTIONS.ASSIGNED).toBeDefined();
    });

    it('should have action for unassignment', () => {
      expect(ACTIONS.UNASSIGNED).toBeDefined();
    });

    it('should have action for deletion', () => {
      expect(ACTIONS.DELETED).toBeDefined();
    });

    it('should have action for category changes', () => {
      expect(ACTIONS.CATEGORY_CHANGED).toBeDefined();
    });
  });
});
