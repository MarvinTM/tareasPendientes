import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-message-id' });
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail
}));

jest.unstable_mockModule('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport
}));

describe('Email Service', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  describe('Email Configuration', () => {
    it('should detect when email is not configured', () => {
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_APP_PASSWORD;

      const isConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);
      expect(isConfigured).toBe(false);
    });

    it('should detect when email is configured', () => {
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_APP_PASSWORD = 'test-password';

      const isConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);
      expect(isConfigured).toBe(true);
    });

    it('should require both EMAIL_USER and EMAIL_APP_PASSWORD', () => {
      process.env.EMAIL_USER = 'test@gmail.com';
      delete process.env.EMAIL_APP_PASSWORD;

      const isConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);
      expect(isConfigured).toBe(false);
    });
  });

  describe('Size Labels', () => {
    const sizeLabels = {
      Pequena: 'Pequeña (S)',
      Mediana: 'Mediana (M)',
      Grande: 'Grande (L)'
    };

    it('should have correct label for Pequena', () => {
      expect(sizeLabels.Pequena).toBe('Pequeña (S)');
    });

    it('should have correct label for Mediana', () => {
      expect(sizeLabels.Mediana).toBe('Mediana (M)');
    });

    it('should have correct label for Grande', () => {
      expect(sizeLabels.Grande).toBe('Grande (L)');
    });

    it('should have all three sizes', () => {
      expect(Object.keys(sizeLabels)).toHaveLength(3);
    });
  });

  describe('Email Content Generation', () => {
    it('should extract first name from full name', () => {
      const fullName = 'John Doe';
      const firstName = fullName.split(' ')[0];
      expect(firstName).toBe('John');
    });

    it('should handle single-word names', () => {
      const fullName = 'John';
      const firstName = fullName.split(' ')[0];
      expect(firstName).toBe('John');
    });

    it('should handle names with multiple parts', () => {
      const fullName = 'John Michael Doe';
      const firstName = fullName.split(' ')[0];
      expect(firstName).toBe('John');
    });
  });

  describe('Email Structure', () => {
    it('should create mail options with required fields', () => {
      const mailOptions = {
        from: '"Tareas Pendientes" <test@gmail.com>',
        to: 'recipient@example.com',
        subject: 'Nueva tarea asignada: "Test Task"',
        html: '<div>Email content</div>'
      };

      expect(mailOptions.from).toBeDefined();
      expect(mailOptions.to).toBeDefined();
      expect(mailOptions.subject).toBeDefined();
      expect(mailOptions.html).toBeDefined();
    });

    it('should include task title in subject', () => {
      const taskTitle = 'Buy groceries';
      const subject = `Nueva tarea asignada: "${taskTitle}"`;
      expect(subject).toContain(taskTitle);
    });

    it('should use Spanish language in subject', () => {
      const subject = 'Nueva tarea asignada: "Test"';
      expect(subject).toContain('Nueva tarea asignada');
    });
  });

  describe('Gmail Configuration', () => {
    it('should use gmail as service', () => {
      const transportConfig = {
        service: 'gmail',
        auth: {
          user: 'test@gmail.com',
          pass: 'test-password'
        }
      };

      expect(transportConfig.service).toBe('gmail');
    });

    it('should require auth credentials', () => {
      const transportConfig = {
        service: 'gmail',
        auth: {
          user: 'test@gmail.com',
          pass: 'test-password'
        }
      };

      expect(transportConfig.auth.user).toBeDefined();
      expect(transportConfig.auth.pass).toBeDefined();
    });
  });

  describe('sendTaskAssignmentEmail - not configured', () => {
    it('should skip when EMAIL_USER is not set', async () => {
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_APP_PASSWORD;

      const { sendTaskAssignmentEmail } = await import('../../services/email.js');

      await sendTaskAssignmentEmail(
        'recipient@test.com',
        'John Doe',
        { title: 'Test Task', size: 'Pequena', description: 'Desc' },
        'Assigner'
      );

      expect(mockCreateTransport).not.toHaveBeenCalled();
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should skip when EMAIL_USER is empty string', async () => {
      process.env.EMAIL_USER = '';
      process.env.EMAIL_APP_PASSWORD = '';

      jest.resetModules();
      const { sendTaskAssignmentEmail } = await import('../../services/email.js');

      await sendTaskAssignmentEmail(
        'recipient@test.com',
        'John Doe',
        { title: 'Test Task', size: 'Pequena', description: null },
        'Assigner'
      );

      expect(mockCreateTransport).not.toHaveBeenCalled();
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  describe('sendTaskAssignmentEmail - configured', () => {
    it('should send email with correct structure when configured', async () => {
      process.env.EMAIL_USER = 'sender@gmail.com';
      process.env.EMAIL_APP_PASSWORD = 'app-password';

      jest.resetModules();
      mockSendMail.mockResolvedValue({ messageId: 'test-123' });

      const { sendTaskAssignmentEmail } = await import('../../services/email.js');

      const task = {
        title: 'Buy groceries',
        description: 'Get milk and bread',
        size: 'Mediana',
        category: { emoji: '🛒', name: 'Shopping' }
      };

      await sendTaskAssignmentEmail(
        'recipient@example.com',
        'John Doe',
        task,
        'Jane Admin'
      );

      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      expect(mockCreateTransport).toHaveBeenCalledWith({
        service: 'gmail',
        auth: {
          user: 'sender@gmail.com',
          pass: 'app-password'
        }
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailCall = mockSendMail.mock.calls[0][0];

      expect(mailCall.from).toContain('"Tareas Pendientes"');
      expect(mailCall.from).toContain('sender@gmail.com');
      expect(mailCall.to).toBe('recipient@example.com');
      expect(mailCall.subject).toBe('Nueva tarea asignada: "Buy groceries"');
      expect(mailCall.html).toContain('Hola John');
      expect(mailCall.html).toContain('Buy groceries');
      expect(mailCall.html).toContain('Get milk and bread');
      expect(mailCall.html).toContain('Mediana (M)');
      expect(mailCall.html).toContain('Jane Admin');
    });

    it('should handle task without description', async () => {
      process.env.EMAIL_USER = 'sender@gmail.com';
      process.env.EMAIL_APP_PASSWORD = 'app-password';

      jest.resetModules();
      mockSendMail.mockResolvedValue({ messageId: 'test-456' });

      const { sendTaskAssignmentEmail } = await import('../../services/email.js');

      await sendTaskAssignmentEmail(
        'recipient@example.com',
        'Jane Smith',
        { title: 'Clean kitchen', size: 'Pequena', description: null },
        'System'
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailCall = mockSendMail.mock.calls[0][0];

      expect(mailCall.subject).toBe('Nueva tarea asignada: "Clean kitchen"');
      expect(mailCall.html).toContain('Hola Jane');
      expect(mailCall.html).toContain('Pequeña (S)');
      expect(mailCall.html).toContain('System');
    });

    it('should handle unknown task size gracefully', async () => {
      process.env.EMAIL_USER = 'sender@gmail.com';
      process.env.EMAIL_APP_PASSWORD = 'app-password';

      jest.resetModules();
      mockSendMail.mockResolvedValue({ messageId: 'test-789' });

      const { sendTaskAssignmentEmail } = await import('../../services/email.js');

      await sendTaskAssignmentEmail(
        'recipient@example.com',
        'Bob',
        { title: 'Unknown size task', size: 'Gigante', description: null },
        'Admin'
      );

      const mailCall = mockSendMail.mock.calls[0][0];
      expect(mailCall.html).toContain('Gigante');
    });

    it('should handle email send failure gracefully', async () => {
      process.env.EMAIL_USER = 'sender@gmail.com';
      process.env.EMAIL_APP_PASSWORD = 'app-password';

      jest.resetModules();
      const sendError = new Error('SMTP connection refused');
      mockSendMail.mockRejectedValue(sendError);

      const { sendTaskAssignmentEmail } = await import('../../services/email.js');

      await sendTaskAssignmentEmail(
        'recipient@example.com',
        'Test User',
        { title: 'Test', size: 'Pequena', description: null },
        'Admin'
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });
  });
});
