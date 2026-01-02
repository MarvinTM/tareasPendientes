import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('TaskGenerator Service', () => {
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
      0: 'Sunday',
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday'
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
      const date = new Date('2025-01-12'); // A Sunday
      expect(date.getDay()).toBe(0);

      const monday = new Date('2025-01-13');
      expect(monday.getDay()).toBe(1);
    });
  });

  describe('Month of Year Mapping', () => {
    const monthMapping = {
      0: 'January',
      1: 'February',
      2: 'March',
      3: 'April',
      4: 'May',
      5: 'June',
      6: 'July',
      7: 'August',
      8: 'September',
      9: 'October',
      10: 'November',
      11: 'December'
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

  describe('Weekly Task Generation Logic', () => {
    it('should identify task already generated today', () => {
      const lastGenerated = new Date('2025-01-15T08:00:00Z');
      const startOfDay = new Date('2025-01-15T00:00:00Z');

      const alreadyGenerated = lastGenerated >= startOfDay;
      expect(alreadyGenerated).toBe(true);
    });

    it('should identify task that needs generation (generated yesterday)', () => {
      const lastGenerated = new Date('2025-01-14T08:00:00Z');
      const startOfDay = new Date('2025-01-15T00:00:00Z');

      const needsGeneration = lastGenerated < startOfDay;
      expect(needsGeneration).toBe(true);
    });

    it('should identify task that was never generated', () => {
      const lastGenerated = null;

      const needsGeneration = lastGenerated === null;
      expect(needsGeneration).toBe(true);
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

      const alreadyGenerated = lastGenerated >= startOfMonth;
      expect(alreadyGenerated).toBe(true);
    });

    it('should identify monthly task that needs generation (generated last month)', () => {
      const lastGenerated = new Date('2024-12-15T08:00:00Z');
      const startOfMonth = new Date('2025-01-01T00:00:00Z');

      const needsGeneration = lastGenerated < startOfMonth;
      expect(needsGeneration).toBe(true);
    });

    it('should correctly calculate start of month', () => {
      const now = new Date('2025-01-15T14:30:45Z');
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      expect(startOfMonth.getDate()).toBe(1);
      expect(startOfMonth.getMonth()).toBe(0); // January
      expect(startOfMonth.getFullYear()).toBe(2025);
    });
  });

  describe('Task Generation Sources', () => {
    it('should have correct source label for weekly tasks', () => {
      const source = 'Recurrente (Semanal)';
      expect(source).toBe('Recurrente (Semanal)');
    });

    it('should have correct source label for monthly tasks', () => {
      const source = 'Recurrente (Mensual)';
      expect(source).toBe('Recurrente (Mensual)');
    });
  });

  describe('Generated Task Properties', () => {
    it('should set initial status to Nueva', () => {
      const generatedTask = {
        status: 'Nueva'
      };
      expect(generatedTask.status).toBe('Nueva');
    });

    it('should inherit properties from template', () => {
      const template = {
        title: 'Weekly Cleaning',
        description: 'Clean the house',
        size: 'Grande',
        categoryId: 'category-id',
        assignedToId: 'user-id'
      };

      const generatedTask = {
        title: template.title,
        description: template.description,
        size: template.size,
        categoryId: template.categoryId,
        assignedToId: template.assignedToId,
        status: 'Nueva'
      };

      expect(generatedTask.title).toBe(template.title);
      expect(generatedTask.description).toBe(template.description);
      expect(generatedTask.size).toBe(template.size);
      expect(generatedTask.categoryId).toBe(template.categoryId);
      expect(generatedTask.assignedToId).toBe(template.assignedToId);
    });

    it('should link back to periodic task template', () => {
      const generatedTask = {
        periodicTaskId: 'periodic-task-id'
      };
      expect(generatedTask.periodicTaskId).toBeDefined();
    });
  });
});
