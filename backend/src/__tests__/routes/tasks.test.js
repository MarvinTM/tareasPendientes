import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const authenticatedUser = { id: 'usr-1', email: 'test@test.com', name: 'Test User', isApproved: true };

const mockPrisma = {
  task: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  taskHistory: {
    findMany: jest.fn()
  },
  user: {
    findUnique: jest.fn()
  },
  category: {
    findUnique: jest.fn()
  }
};

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = authenticatedUser;
  next();
});
const mockGenerateToken = jest.fn();

const mockLogTaskChange = jest.fn().mockResolvedValue({});
const mockEmitTaskUpdate = jest.fn();
const mockSendTaskAssignmentEmail = jest.fn();
const mockGeneratePeriodicTasks = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../config/passport.js', () => ({
  prisma: mockPrisma
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticateToken: mockAuthenticateToken,
  generateToken: mockGenerateToken
}));

jest.unstable_mockModule('../../services/taskHistory.js', () => ({
  logTaskChange: mockLogTaskChange,
  ACTIONS: {
    CREATED: 'CREATED', STATUS_CHANGED: 'STATUS_CHANGED', SIZE_CHANGED: 'SIZE_CHANGED',
    TITLE_UPDATED: 'TITLE_UPDATED', DESCRIPTION_UPDATED: 'DESCRIPTION_UPDATED',
    ASSIGNED: 'ASSIGNED', UNASSIGNED: 'UNASSIGNED', DELETED: 'DELETED',
    CATEGORY_CHANGED: 'CATEGORY_CHANGED'
  }
}));

jest.unstable_mockModule('../../socket.js', () => ({
  emitTaskUpdate: mockEmitTaskUpdate,
  setIO: jest.fn(),
  getIO: jest.fn()
}));

jest.unstable_mockModule('../../services/email.js', () => ({
  sendTaskAssignmentEmail: mockSendTaskAssignmentEmail
}));

jest.unstable_mockModule('../../services/taskGenerator.js', () => ({
  generatePeriodicTasks: mockGeneratePeriodicTasks
}));

const router = (await import('../../routes/tasks.js')).default;
const app = express();
app.use(express.json());
app.use(router);

describe('Tasks Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req, res, next) => {
      req.user = authenticatedUser;
      next();
    });
  });

  describe('GET /', () => {
    it('should return 200 with tasks grouped by status', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { id: '1', title: 'Task 1', status: 'Nueva' },
        { id: '2', title: 'Task 2', status: 'EnProgreso' },
        { id: '3', title: 'Task 3', status: 'Completada' }
      ]);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.Nueva).toHaveLength(1);
      expect(res.body.EnProgreso).toHaveLength(1);
      expect(res.body.Completada).toHaveLength(1);
      expect(mockGeneratePeriodicTasks).toHaveBeenCalled();
    });

    it('should return empty groups when no tasks exist', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.Nueva).toHaveLength(0);
      expect(res.body.EnProgreso).toHaveLength(0);
      expect(res.body.Completada).toHaveLength(0);
    });

    it('should return 500 on database error', async () => {
      mockPrisma.task.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch tasks');
    });
  });

  describe('POST /', () => {
    it('should return 400 when title is missing', async () => {
      const res = await request(app).post('/').send({ size: 'Pequena', categoryId: 'cat-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Title is required');
    });

    it('should return 400 when title is whitespace only', async () => {
      const res = await request(app).post('/').send({ title: '   ', size: 'Pequena', categoryId: 'cat-1' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when size is invalid', async () => {
      const res = await request(app).post('/').send({ title: 'Task', size: 'Invalid', categoryId: 'cat-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Valid size is required');
    });

    it('should return 400 when categoryId is missing', async () => {
      const res = await request(app).post('/').send({ title: 'Task', size: 'Pequena' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Category is required');
    });

    it('should return 400 when category does not exist', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/').send({ title: 'Task', size: 'Pequena', categoryId: 'nonexistent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid category');
    });

    it('should return 400 when assignee is invalid', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Cat' });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/').send({
        title: 'Task', size: 'Pequena', categoryId: 'cat-1', assignedToId: 'bad-user'
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid assignee');
    });

    it('should return 400 when assignee is not approved', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Cat' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'usr-2', isApproved: false });

      const res = await request(app).post('/').send({
        title: 'Task', size: 'Pequena', categoryId: 'cat-1', assignedToId: 'usr-2'
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid assignee');
    });

    it('should create a task successfully with all fields', async () => {
      const category = { id: 'cat-1', name: 'Work', emoji: '💼' };
      const createdTask = {
        id: 'new-task', title: 'New Task', description: 'Desc',
        size: 'Pequena', status: 'Nueva', category
      };

      mockPrisma.category.findUnique.mockResolvedValue(category);
      mockPrisma.task.create.mockResolvedValue(createdTask);

      const res = await request(app).post('/').send({
        title: 'New Task', description: 'Desc', size: 'Pequena', categoryId: 'cat-1'
      });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Task');
      expect(mockLogTaskChange).toHaveBeenCalled();
      expect(mockEmitTaskUpdate).toHaveBeenCalledWith('task:created', createdTask);
    });

    it('should create a task with assignee and send email', async () => {
      const category = { id: 'cat-1', name: 'Work', emoji: '💼' };
      const assignee = { id: 'usr-2', email: 'assignee@test.com', name: 'Assignee', isApproved: true };
      const createdTask = { id: 'new-task', title: 'Assigned Task', assignedTo: assignee, category };

      mockPrisma.category.findUnique.mockResolvedValue(category);
      mockPrisma.user.findUnique.mockResolvedValue(assignee);
      mockPrisma.task.create.mockResolvedValue(createdTask);

      const res = await request(app).post('/').send({
        title: 'Assigned Task', size: 'Mediana', categoryId: 'cat-1', assignedToId: 'usr-2'
      });

      expect(res.status).toBe(201);
      expect(mockSendTaskAssignmentEmail).toHaveBeenCalledWith(
        'assignee@test.com', 'Assignee', createdTask, 'Test User'
      );
    });

    it('should trim title whitespace', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Cat' });
      mockPrisma.task.create.mockResolvedValue({ id: 't1', title: 'Trimmed', category: {} });

      const res = await request(app).post('/').send({
        title: '  Trimmed  ', size: 'Pequena', categoryId: 'cat-1'
      });

      expect(res.status).toBe(201);
      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: 'Trimmed' }) })
      );
    });

    it('should return 500 on database error during creation', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.task.create.mockRejectedValue(new Error('DB error'));

      const res = await request(app).post('/').send({
        title: 'Task', size: 'Pequena', categoryId: 'cat-1'
      });

      expect(res.status).toBe(500);
    });
  });

  describe('PATCH /:id', () => {
    it('should return 404 when task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      const res = await request(app).patch('/nonexistent').send({ title: 'New' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('should return 400 when status is invalid', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'T', status: 'Nueva' });

      const res = await request(app).patch('/t1').send({ status: 'Invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid status');
    });

    it('should return 400 when size is invalid', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'T', size: 'Pequena' });

      const res = await request(app).patch('/t1').send({ size: 'Huge' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid size');
    });

    it('should update title and log change', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Old Title' });
      mockPrisma.task.update.mockResolvedValue({ id: 't1', title: 'New Title' });

      const res = await request(app).patch('/t1').send({ title: 'New Title' });

      expect(res.status).toBe(200);
      expect(mockLogTaskChange).toHaveBeenCalledWith('t1', 'usr-1', 'TITLE_UPDATED', 'Old Title', 'New Title');
      expect(mockEmitTaskUpdate).toHaveBeenCalledWith('task:updated', expect.any(Object));
    });

    it('should update status to Completada and set completedAt', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', status: 'EnProgreso', completedAt: null });
      mockPrisma.task.update.mockResolvedValue({ id: 't1', status: 'Completada', completedAt: new Date() });

      const res = await request(app).patch('/t1').send({ status: 'Completada' });

      expect(res.status).toBe(200);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'Completada' }) })
      );
    });

    it('should clear completedAt when moving from Completada', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', status: 'Completada', completedAt: new Date() });
      mockPrisma.task.update.mockResolvedValue({ id: 't1', status: 'Nueva', completedAt: null });

      const res = await request(app).patch('/t1').send({ status: 'Nueva' });

      expect(res.status).toBe(200);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ completedAt: null }) })
      );
    });

    it('should handle assignment to a new user', async () => {
      const assignee = { id: 'usr-2', name: 'New Assignee', email: 'new@test.com', isApproved: true };
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1', assignedToId: null,
        assignedTo: null, category: null
      });
      mockPrisma.user.findUnique.mockResolvedValue(assignee);
      mockPrisma.task.update.mockResolvedValue({ id: 't1', assignedTo: assignee });

      const res = await request(app).patch('/t1').send({ assignedToId: 'usr-2' });

      expect(res.status).toBe(200);
      expect(mockLogTaskChange).toHaveBeenCalledWith('t1', 'usr-1', 'ASSIGNED', null, 'New Assignee');
      expect(mockSendTaskAssignmentEmail).toHaveBeenCalled();
    });

    it('should handle unassignment', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1', assignedToId: 'usr-2',
        assignedTo: { id: 'usr-2', name: 'Old Assignee' },
        category: null
      });
      mockPrisma.task.update.mockResolvedValue({ id: 't1', assignedTo: null });

      const res = await request(app).patch('/t1').send({ assignedToId: null });

      expect(res.status).toBe(200);
      expect(mockLogTaskChange).toHaveBeenCalledWith('t1', 'usr-1', 'UNASSIGNED', 'Old Assignee', null);
    });

    it('should return 400 when assignee is not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', assignedToId: null, assignedTo: null, category: null });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).patch('/t1').send({ assignedToId: 'bad-id' });

      expect(res.status).toBe(400);
    });

    it('should handle category change', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1', categoryId: 'cat-1',
        category: { id: 'cat-1', name: 'Old Cat' }
      });
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-2', name: 'New Cat' });
      mockPrisma.task.update.mockResolvedValue({ id: 't1', category: { id: 'cat-2', name: 'New Cat' } });

      const res = await request(app).patch('/t1').send({ categoryId: 'cat-2' });

      expect(res.status).toBe(200);
      expect(mockLogTaskChange).toHaveBeenCalledWith('t1', 'usr-1', 'CATEGORY_CHANGED', 'Old Cat', 'New Cat');
    });

    it('should return 400 when category does not exist', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', categoryId: 'cat-1', category: { id: 'cat-1' } });
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const res = await request(app).patch('/t1').send({ categoryId: 'bad-cat' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid category');
    });

    it('should return existing task when no changes are made', async () => {
      const existingTask = { id: 't1', title: 'Same', status: 'Nueva', size: 'Pequena' };
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);

      const res = await request(app).patch('/t1').send({ title: 'Same' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(existingTask);
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });

    it('should return 500 on update error', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Old' });
      mockPrisma.task.update.mockRejectedValue(new Error('DB error'));

      const res = await request(app).patch('/t1').send({ title: 'New' });

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /:id', () => {
    it('should return 404 when task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      const res = await request(app).delete('/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('should delete task successfully', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'Task to delete' });

      const res = await request(app).delete('/t1');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Task deleted');
      expect(mockLogTaskChange).toHaveBeenCalledWith('t1', 'usr-1', 'DELETED', 'Task to delete', null);
      expect(mockPrisma.task.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
      expect(mockEmitTaskUpdate).toHaveBeenCalledWith('task:deleted', { id: 't1' });
    });

    it('should return 500 on delete error', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', title: 'T' });
      mockPrisma.task.delete.mockRejectedValue(new Error('DB error'));

      const res = await request(app).delete('/t1');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /:id/history', () => {
    it('should return task and history', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ title: 'Task' });
      mockPrisma.taskHistory.findMany.mockResolvedValue([
        { id: 'h1', action: 'CREATED', timestamp: new Date(), user: { id: 'usr-1', name: 'Test' } }
      ]);

      const res = await request(app).get('/t1/history');

      expect(res.status).toBe(200);
      expect(res.body.task).toEqual({ title: 'Task' });
      expect(res.body.history).toHaveLength(1);
    });

    it('should return 500 on history fetch error', async () => {
      mockPrisma.task.findUnique.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/t1/history');

      expect(res.status).toBe(500);
    });
  });

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      mockAuthenticateToken.mockImplementationOnce((req, res) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      const res = await request(app).get('/');

      expect(res.status).toBe(401);
    });
  });
});
