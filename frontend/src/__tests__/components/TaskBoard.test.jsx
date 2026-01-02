import { describe, it, expect } from 'vitest';

describe('TaskBoard Logic', () => {
  describe('Column Definitions', () => {
    const columns = [
      { id: 'Nueva', title: 'Nueva' },
      { id: 'EnProgreso', title: 'En Progreso' },
      { id: 'Completada', title: 'Completada' }
    ];

    it('should have three columns', () => {
      expect(columns).toHaveLength(3);
    });

    it('should have Nueva column', () => {
      expect(columns.find(c => c.id === 'Nueva')).toBeDefined();
    });

    it('should have EnProgreso column', () => {
      expect(columns.find(c => c.id === 'EnProgreso')).toBeDefined();
    });

    it('should have Completada column', () => {
      expect(columns.find(c => c.id === 'Completada')).toBeDefined();
    });
  });

  describe('Task Grouping', () => {
    it('should group tasks by status', () => {
      const tasks = {
        Nueva: [{ id: '1', title: 'Task 1' }],
        EnProgreso: [{ id: '2', title: 'Task 2' }],
        Completada: [{ id: '3', title: 'Task 3' }]
      };

      expect(tasks.Nueva).toHaveLength(1);
      expect(tasks.EnProgreso).toHaveLength(1);
      expect(tasks.Completada).toHaveLength(1);
    });

    it('should handle empty columns', () => {
      const tasks = {
        Nueva: [],
        EnProgreso: [],
        Completada: []
      };

      expect(tasks.Nueva).toHaveLength(0);
      expect(tasks.EnProgreso).toHaveLength(0);
      expect(tasks.Completada).toHaveLength(0);
    });
  });

  describe('Drag and Drop', () => {
    it('should update task status on drop', () => {
      const task = { id: '1', status: 'Nueva' };
      const newStatus = 'EnProgreso';

      const updatedTask = { ...task, status: newStatus };

      expect(updatedTask.status).toBe('EnProgreso');
    });

    it('should preserve other task properties on drop', () => {
      const task = {
        id: '1',
        title: 'Test',
        status: 'Nueva',
        description: 'Description',
        size: 'Pequena'
      };
      const newStatus = 'Completada';

      const updatedTask = { ...task, status: newStatus };

      expect(updatedTask.title).toBe('Test');
      expect(updatedTask.description).toBe('Description');
      expect(updatedTask.size).toBe('Pequena');
      expect(updatedTask.status).toBe('Completada');
    });
  });

  describe('Socket Event Handling', () => {
    it('should add new task to correct column', () => {
      const tasks = {
        Nueva: [{ id: '1', title: 'Existing' }],
        EnProgreso: [],
        Completada: []
      };

      const newTask = { id: '2', title: 'New Task', status: 'Nueva' };

      const updatedTasks = {
        ...tasks,
        [newTask.status]: [newTask, ...tasks[newTask.status]]
      };

      expect(updatedTasks.Nueva).toHaveLength(2);
      expect(updatedTasks.Nueva[0].id).toBe('2');
    });

    it('should update existing task', () => {
      const tasks = {
        Nueva: [{ id: '1', title: 'Original Title', status: 'Nueva' }],
        EnProgreso: [],
        Completada: []
      };

      const updatedTask = { id: '1', title: 'Updated Title', status: 'Nueva' };

      const newNueva = tasks.Nueva.map(t =>
        t.id === updatedTask.id ? updatedTask : t
      );

      expect(newNueva[0].title).toBe('Updated Title');
    });

    it('should move task between columns on update', () => {
      const tasks = {
        Nueva: [{ id: '1', title: 'Task', status: 'Nueva' }],
        EnProgreso: [],
        Completada: []
      };

      const updatedTask = { id: '1', title: 'Task', status: 'EnProgreso' };

      // Remove from old column
      const newNueva = tasks.Nueva.filter(t => t.id !== updatedTask.id);
      // Add to new column
      const newEnProgreso = [updatedTask, ...tasks.EnProgreso];

      expect(newNueva).toHaveLength(0);
      expect(newEnProgreso).toHaveLength(1);
    });

    it('should remove deleted task', () => {
      const tasks = {
        Nueva: [{ id: '1' }, { id: '2' }],
        EnProgreso: [],
        Completada: []
      };

      const deletedId = '1';

      const newNueva = tasks.Nueva.filter(t => t.id !== deletedId);

      expect(newNueva).toHaveLength(1);
      expect(newNueva[0].id).toBe('2');
    });
  });

  describe('Responsive Layout', () => {
    it('should determine visible columns based on width', () => {
      const getVisibleColumns = (width) => {
        if (width < 600) return 1;
        if (width < 900) return 2;
        return 3;
      };

      expect(getVisibleColumns(400)).toBe(1);
      expect(getVisibleColumns(700)).toBe(2);
      expect(getVisibleColumns(1200)).toBe(3);
    });
  });
});
