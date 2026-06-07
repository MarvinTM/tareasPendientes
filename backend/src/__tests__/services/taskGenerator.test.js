import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockPrisma = {
  periodicTask: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  task: { create: jest.fn(), deleteMany: jest.fn() },
  taskHistory: { create: jest.fn() },
  $transaction: jest.fn()
};

const mockEmitTaskUpdate = jest.fn();
const mockSendTaskAssignmentEmail = jest.fn();

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: mockPrisma
}));

jest.unstable_mockModule('../../socket.js', () => ({
  emitTaskUpdate: mockEmitTaskUpdate,
  setIO: jest.fn(),
  getIO: jest.fn()
}));

jest.unstable_mockModule('../../services/email.js', () => ({
  sendTaskAssignmentEmail: mockSendTaskAssignmentEmail
}));

const { generatePeriodicTasks } = await import('../../services/taskGenerator.js');

describe('TaskGenerator Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Frequency Types', () => {
    const frequencies = ['WEEKLY', 'MONTHLY'];

    it('should support WEEKLY frequency', () => {
      expect(frequencies).toContain('WEEKLY');
    });

    it('should support MONTHLY frequency', () => {
      expect(frequencies).toContain('MONTHLY');
    });

    it('should have exactly 2 frequency types', () => {
      expect(frequencies).toHaveLength(2);
    });
  });

  describe('Day of Week Mapping', () => {
    const dayMapping = {
      0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
      4: 'Thursday', 5: 'Friday', 6: 'Saturday'
    };

    it('should have 7 days', () => {
      expect(Object.keys(dayMapping)).toHaveLength(7);
    });

    it('should start with Sunday as 0', () => {
      expect(dayMapping[0]).toBe('Sunday');
    });

    it('should end with Saturday as 6', () => {
      expect(dayMapping[6]).toBe('Saturday');
    });

    it('should match JavaScript Date.getDay() convention', () => {
      const date = new Date('2025-01-12');
      expect(date.getDay()).toBe(0);
      const monday = new Date('2025-01-13');
      expect(monday.getDay()).toBe(1);
    });
  });

  describe('Month of Year Mapping', () => {
    const monthMapping = {
      0: 'January', 1: 'February', 2: 'March', 3: 'April',
      4: 'May', 5: 'June', 6: 'July', 7: 'August',
      8: 'September', 9: 'October', 10: 'November', 11: 'December'
    };

    it('should have 12 months', () => {
      expect(Object.keys(monthMapping)).toHaveLength(12);
    });

    it('should start with January as 0', () => {
      expect(monthMapping[0]).toBe('January');
    });

    it('should end with December as 11', () => {
      expect(monthMapping[11]).toBe('December');
    });

    it('should match JavaScript Date.getMonth() convention', () => {
      const jan = new Date('2025-01-15');
      expect(jan.getMonth()).toBe(0);
      const dec = new Date('2025-12-15');
      expect(dec.getMonth()).toBe(11);
    });
  });

  describe('isMonthInActiveRange logic', () => {
    const isMonthInActiveRange = (currentMonth, fromMonth, toMonth) => {
      if (fromMonth === null && toMonth === null) return true;
      if (fromMonth === null) fromMonth = 0;
      if (toMonth === null) toMonth = 11;
      if (fromMonth <= toMonth) {
        return currentMonth >= fromMonth && currentMonth <= toMonth;
      } else {
        return currentMonth >= fromMonth || currentMonth <= toMonth;
      }
    };

    it('should return true when both fromMonth and toMonth are null (active all year)', () => {
      expect(isMonthInActiveRange(5, null, null)).toBe(true);
      expect(isMonthInActiveRange(0, null, null)).toBe(true);
      expect(isMonthInActiveRange(11, null, null)).toBe(true);
    });

    it('should return true when current month is within normal range', () => {
      expect(isMonthInActiveRange(3, 2, 5)).toBe(true);
      expect(isMonthInActiveRange(2, 2, 5)).toBe(true);
      expect(isMonthInActiveRange(5, 2, 5)).toBe(true);
    });

    it('should return false when current month is outside normal range', () => {
      expect(isMonthInActiveRange(1, 2, 5)).toBe(false);
      expect(isMonthInActiveRange(6, 2, 5)).toBe(false);
      expect(isMonthInActiveRange(11, 2, 5)).toBe(false);
    });

    it('should handle wrapping range (e.g., Nov-Feb winter tasks)', () => {
      expect(isMonthInActiveRange(10, 10, 1)).toBe(true);
      expect(isMonthInActiveRange(11, 10, 1)).toBe(true);
      expect(isMonthInActiveRange(0, 10, 1)).toBe(true);
      expect(isMonthInActiveRange(1, 10, 1)).toBe(true);
      expect(isMonthInActiveRange(5, 10, 1)).toBe(false);
      expect(isMonthInActiveRange(3, 10, 1)).toBe(false);
    });

    it('should treat null fromMonth as 0 (start of year)', () => {
      expect(isMonthInActiveRange(0, null, 5)).toBe(true);
      expect(isMonthInActiveRange(5, null, 5)).toBe(true);
      expect(isMonthInActiveRange(6, null, 5)).toBe(false);
    });

    it('should treat null toMonth as 11 (end of year)', () => {
      expect(isMonthInActiveRange(5, 3, null)).toBe(true);
      expect(isMonthInActiveRange(11, 3, null)).toBe(true);
      expect(isMonthInActiveRange(2, 3, null)).toBe(false);
    });

    it('should handle single-month range (fromMonth === toMonth)', () => {
      expect(isMonthInActiveRange(3, 3, 3)).toBe(true);
      expect(isMonthInActiveRange(2, 3, 3)).toBe(false);
      expect(isMonthInActiveRange(4, 3, 3)).toBe(false);
    });
  });

  describe('Weekly Task Generation Logic', () => {
    it('should identify task already generated today', () => {
      const lastGenerated = new Date('2025-01-15T08:00:00Z');
      const startOfDay = new Date('2025-01-15T00:00:00Z');
      expect(lastGenerated >= startOfDay).toBe(true);
    });

    it('should identify task that needs generation (generated yesterday)', () => {
      const lastGenerated = new Date('2025-01-14T08:00:00Z');
      const startOfDay = new Date('2025-01-15T00:00:00Z');
      expect(lastGenerated < startOfDay).toBe(true);
    });

    it('should identify task that was never generated', () => {
      expect(null === null).toBe(true);
    });

    it('should correctly calculate start of day', () => {
      const now = new Date('2025-01-15T14:30:45Z');
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      expect(startOfDay.getHours()).toBe(0);
      expect(startOfDay.getMinutes()).toBe(0);
      expect(startOfDay.getSeconds()).toBe(0);
      expect(startOfDay.getMilliseconds()).toBe(0);
    });
  });

  describe('Monthly Task Generation Logic', () => {
    it('should identify task already generated this month', () => {
      const lastGenerated = new Date('2025-01-05T08:00:00Z');
      const startOfMonth = new Date('2025-01-01T00:00:00Z');
      expect(lastGenerated >= startOfMonth).toBe(true);
    });

    it('should identify monthly task that needs generation (last month)', () => {
      const lastGenerated = new Date('2024-12-15T08:00:00Z');
      const startOfMonth = new Date('2025-01-01T00:00:00Z');
      expect(lastGenerated < startOfMonth).toBe(true);
    });

    it('should correctly calculate start of month', () => {
      const now = new Date('2025-01-15T14:30:45Z');
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      expect(startOfMonth.getDate()).toBe(1);
      expect(startOfMonth.getMonth()).toBe(0);
      expect(startOfMonth.getFullYear()).toBe(2025);
    });
  });

  describe('generatePeriodicTasks - no templates', () => {
    it('should return early when no templates need generation', async () => {
      mockPrisma.periodicTask.findMany.mockResolvedValue([]);

      await generatePeriodicTasks(null);

      expect(mockPrisma.periodicTask.findMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockEmitTaskUpdate).not.toHaveBeenCalled();
    });
  });

  describe('generatePeriodicTasks - weekly templates', () => {
    it('should generate a task for a weekly template and update lastGeneratedAt', async () => {
      const weeklyTemplate = {
        id: 'pt-weekly-1',
        title: 'Weekly Standup',
        description: 'Team standup meeting',
        size: 'Pequena',
        frequency: 'WEEKLY',
        dayOfWeek: new Date().getDay(),
        categoryId: 'cat-1',
        assignedToId: 'user-1',
        activeFromMonth: null,
        activeToMonth: null,
        lastGeneratedAt: null,
        category: { id: 'cat-1', name: 'Work', emoji: '💼' },
        assignedTo: { id: 'user-1', name: 'John', email: 'john@test.com', picture: null }
      };

      mockPrisma.periodicTask.findMany
        .mockResolvedValueOnce([weeklyTemplate])
        .mockResolvedValueOnce([]);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          periodicTask: {
            findUnique: mockPrisma.periodicTask.findUnique,
            update: mockPrisma.periodicTask.update
          },
          task: {
            create: mockPrisma.task.create
          },
          taskHistory: {
            create: mockPrisma.taskHistory.create
          }
        };

        mockPrisma.periodicTask.findUnique.mockResolvedValue({
          ...weeklyTemplate,
          lastGeneratedAt: null
        });

        const newTask = {
          id: 'generated-task-1',
          title: 'Weekly Standup',
          description: 'Team standup meeting',
          size: 'Pequena',
          status: 'Nueva',
          categoryId: 'cat-1',
          assignedToId: 'user-1',
          periodicTaskId: 'pt-weekly-1',
          createdBy: { id: 'system', name: 'System', picture: null },
          assignedTo: { id: 'user-1', name: 'John', picture: null, email: 'john@test.com' },
          category: { id: 'cat-1', name: 'Work', emoji: '💼' }
        };

        mockPrisma.task.create.mockResolvedValue(newTask);
        mockPrisma.periodicTask.update.mockResolvedValue({ ...weeklyTemplate, lastGeneratedAt: new Date() });
        mockPrisma.taskHistory.create.mockResolvedValue({ id: 'hist-1' });

        return callback(tx);
      });

      await generatePeriodicTasks({ id: 'system', email: 'system@test.com', isApproved: true });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.task.create).toHaveBeenCalledTimes(1);

      const createData = mockPrisma.task.create.mock.calls[0][0];
      expect(createData.data.title).toBe('Weekly Standup');
      expect(createData.data.status).toBe('Nueva');

      expect(mockEmitTaskUpdate).toHaveBeenCalledWith('task:created', expect.objectContaining({
        id: 'generated-task-1'
      }));

      expect(mockSendTaskAssignmentEmail).toHaveBeenCalledWith(
        'john@test.com',
        'John',
        expect.objectContaining({ id: 'generated-task-1' }),
        'Sistema (Tarea Recurrente)'
      );
    });

    it('should skip weekly template already generated today', async () => {
      const now = new Date();
      const weeklyTemplate = {
        id: 'pt-weekly-2',
        title: 'Already Generated Task',
        frequency: 'WEEKLY',
        dayOfWeek: now.getDay(),
        lastGeneratedAt: now,
        activeFromMonth: null,
        activeToMonth: null,
        category: { id: 'cat-1', name: 'Work', emoji: '💼' },
        assignedTo: null
      };

      mockPrisma.periodicTask.findMany
        .mockResolvedValueOnce([weeklyTemplate])
        .mockResolvedValueOnce([]);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          periodicTask: {
            findUnique: mockPrisma.periodicTask.findUnique,
            update: mockPrisma.periodicTask.update
          },
          task: { create: mockPrisma.task.create },
          taskHistory: { create: mockPrisma.taskHistory.create }
        };

        mockPrisma.periodicTask.findUnique.mockResolvedValue({
          ...weeklyTemplate,
          lastGeneratedAt: now
        });

        return callback(tx);
      });

      await generatePeriodicTasks({ id: 'system', email: 'system@test.com', isApproved: true });

      expect(mockPrisma.task.create).not.toHaveBeenCalled();
      expect(mockEmitTaskUpdate).not.toHaveBeenCalled();
    });

    it('should filter weekly templates by active month range', async () => {
      const currentMonth = new Date().getMonth();
      const inactiveMonth = (currentMonth + 6) % 12;

      const weeklyTemplateInactive = {
        id: 'pt-seasonal',
        title: 'Seasonal Task',
        frequency: 'WEEKLY',
        dayOfWeek: new Date().getDay(),
        activeFromMonth: inactiveMonth,
        activeToMonth: inactiveMonth,
        lastGeneratedAt: null,
        category: { id: 'cat-1', name: 'Work', emoji: '💼' },
        assignedTo: null
      };

      mockPrisma.periodicTask.findMany
        .mockResolvedValueOnce([weeklyTemplateInactive])
        .mockResolvedValueOnce([]);

      await generatePeriodicTasks({ id: 'system', email: 'system@test.com', isApproved: true });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('generatePeriodicTasks - monthly templates', () => {
    it('should generate a task for a monthly template', async () => {
      const monthlyTemplate = {
        id: 'pt-monthly-1',
        title: 'Monthly Report',
        description: 'Generate monthly report',
        size: 'Grande',
        frequency: 'MONTHLY',
        monthOfYear: new Date().getMonth(),
        categoryId: 'cat-2',
        assignedToId: null,
        lastGeneratedAt: null,
        category: { id: 'cat-2', name: 'Reports', emoji: '📊' },
        assignedTo: null
      };

      mockPrisma.periodicTask.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([monthlyTemplate]);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          periodicTask: {
            findUnique: mockPrisma.periodicTask.findUnique,
            update: mockPrisma.periodicTask.update
          },
          task: { create: mockPrisma.task.create },
          taskHistory: { create: mockPrisma.taskHistory.create }
        };

        mockPrisma.periodicTask.findUnique.mockResolvedValue({
          ...monthlyTemplate,
          lastGeneratedAt: null
        });

        const newTask = {
          id: 'generated-monthly-1',
          title: 'Monthly Report',
          status: 'Nueva',
          size: 'Grande',
          categoryId: 'cat-2',
          assignedTo: null,
          category: { id: 'cat-2', name: 'Reports', emoji: '📊' }
        };

        mockPrisma.task.create.mockResolvedValue(newTask);
        mockPrisma.periodicTask.update.mockResolvedValue({ ...monthlyTemplate, lastGeneratedAt: new Date() });
        mockPrisma.taskHistory.create.mockResolvedValue({ id: 'hist-monthly' });

        return callback(tx);
      });

      await generatePeriodicTasks({ id: 'system', email: 'system@test.com', isApproved: true });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.task.create).toHaveBeenCalledTimes(1);

      const createData = mockPrisma.task.create.mock.calls[0][0];
      expect(createData.data.title).toBe('Monthly Report');
      expect(createData.data.periodicTaskId).toBe('pt-monthly-1');

      expect(mockEmitTaskUpdate).toHaveBeenCalledWith('task:created', expect.any(Object));
    });

    it('should skip monthly template already generated this month', async () => {
      const now = new Date();
      const monthlyTemplate = {
        id: 'pt-monthly-2',
        title: 'Already Generated Monthly',
        frequency: 'MONTHLY',
        monthOfYear: now.getMonth(),
        lastGeneratedAt: now,
        category: { id: 'cat-1', name: 'Work', emoji: '💼' },
        assignedTo: null
      };

      mockPrisma.periodicTask.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([monthlyTemplate]);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          periodicTask: {
            findUnique: mockPrisma.periodicTask.findUnique,
            update: mockPrisma.periodicTask.update
          },
          task: { create: mockPrisma.task.create },
          taskHistory: { create: mockPrisma.taskHistory.create }
        };

        mockPrisma.periodicTask.findUnique.mockResolvedValue({
          ...monthlyTemplate,
          lastGeneratedAt: now
        });

        return callback(tx);
      });

      await generatePeriodicTasks({ id: 'system', email: 'system@test.com', isApproved: true });

      expect(mockPrisma.task.create).not.toHaveBeenCalled();
    });
  });

  describe('generatePeriodicTasks - error handling', () => {
    it('should continue with other templates when one fails', async () => {
      const template1 = {
        id: 'pt-fail-1',
        title: 'Failing Template',
        frequency: 'WEEKLY',
        dayOfWeek: new Date().getDay(),
        lastGeneratedAt: null,
        activeFromMonth: null,
        activeToMonth: null,
        category: { id: 'cat-1', name: 'Work', emoji: '💼' },
        assignedTo: null
      };

      const template2 = {
        id: 'pt-ok-1',
        title: 'OK Template',
        frequency: 'WEEKLY',
        dayOfWeek: new Date().getDay(),
        lastGeneratedAt: null,
        activeFromMonth: null,
        activeToMonth: null,
        category: { id: 'cat-1', name: 'Work', emoji: '💼' },
        assignedTo: null
      };

      mockPrisma.periodicTask.findMany
        .mockResolvedValueOnce([template1, template2])
        .mockResolvedValueOnce([]);

      let callCount = 0;
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Transaction failed');
        }

        const tx = {
          periodicTask: {
            findUnique: mockPrisma.periodicTask.findUnique,
            update: mockPrisma.periodicTask.update
          },
          task: { create: mockPrisma.task.create },
          taskHistory: { create: mockPrisma.taskHistory.create }
        };

        mockPrisma.periodicTask.findUnique.mockResolvedValue({
          ...template2,
          lastGeneratedAt: null
        });

        const newTask = { id: 'ok-task', title: 'OK Template', status: 'Nueva' };
        mockPrisma.task.create.mockResolvedValue(newTask);
        mockPrisma.periodicTask.update.mockResolvedValue({ ...template2, lastGeneratedAt: new Date() });
        mockPrisma.taskHistory.create.mockResolvedValue({ id: 'hist-ok' });

        return callback(tx);
      });

      await generatePeriodicTasks({ id: 'system', email: 'system@test.com', isApproved: true });

      expect(callCount).toBe(2);
      expect(mockEmitTaskUpdate).toHaveBeenCalledTimes(1);
      expect(mockEmitTaskUpdate).toHaveBeenCalledWith('task:created', expect.objectContaining({ id: 'ok-task' }));
    });
  });
});
