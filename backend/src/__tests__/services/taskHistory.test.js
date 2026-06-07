import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockTaskHistoryCreate = jest.fn();
jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: {
    taskHistory: {
      create: mockTaskHistoryCreate
    }
  }
}));

const { ACTIONS, logTaskChange } = await import('../../services/taskHistory.js');

describe('TaskHistory Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  describe('logTaskChange', () => {
    it('should call prisma.taskHistory.create with correct data', async () => {
      const createdRecord = {
        id: 'history-id',
        taskId: 'task-1',
        userId: 'user-1',
        action: 'CREATED',
        previousValue: null,
        newValue: 'New Task Title',
        timestamp: new Date()
      };
      mockTaskHistoryCreate.mockResolvedValue(createdRecord);

      const result = await logTaskChange('task-1', 'user-1', ACTIONS.CREATED, null, 'New Task Title');

      expect(mockTaskHistoryCreate).toHaveBeenCalledTimes(1);
      expect(mockTaskHistoryCreate).toHaveBeenCalledWith({
        data: {
          taskId: 'task-1',
          userId: 'user-1',
          action: 'CREATED',
          previousValue: null,
          newValue: 'New Task Title'
        }
      });
      expect(result).toEqual(createdRecord);
    });

    it('should log status change with previous and new values', async () => {
      const createdRecord = { id: 'h1', action: 'STATUS_CHANGED' };
      mockTaskHistoryCreate.mockResolvedValue(createdRecord);

      await logTaskChange('task-2', 'user-2', ACTIONS.STATUS_CHANGED, 'Nueva', 'EnProgreso');

      expect(mockTaskHistoryCreate).toHaveBeenCalledWith({
        data: {
          taskId: 'task-2',
          userId: 'user-2',
          action: 'STATUS_CHANGED',
          previousValue: 'Nueva',
          newValue: 'EnProgreso'
        }
      });
    });

    it('should default previousValue and newValue to null when not provided', async () => {
      mockTaskHistoryCreate.mockResolvedValue({ id: 'h2' });

      await logTaskChange('task-3', 'user-3', ACTIONS.DELETED);

      expect(mockTaskHistoryCreate).toHaveBeenCalledWith({
        data: {
          taskId: 'task-3',
          userId: 'user-3',
          action: 'DELETED',
          previousValue: null,
          newValue: null
        }
      });
    });

    it('should log assignment with previous assignee name and new assignee name', async () => {
      mockTaskHistoryCreate.mockResolvedValue({ id: 'h3' });

      await logTaskChange('task-4', 'user-4', ACTIONS.ASSIGNED, 'John Doe', 'Jane Doe');

      expect(mockTaskHistoryCreate).toHaveBeenCalledWith({
        data: {
          taskId: 'task-4',
          userId: 'user-4',
          action: 'ASSIGNED',
          previousValue: 'John Doe',
          newValue: 'Jane Doe'
        }
      });
    });

    it('should propagate errors from Prisma', async () => {
      const dbError = new Error('Database connection failed');
      mockTaskHistoryCreate.mockRejectedValue(dbError);

      await expect(
        logTaskChange('task-5', 'user-5', ACTIONS.CREATED, null, 'Title')
      ).rejects.toThrow('Database connection failed');
    });
  });
});
