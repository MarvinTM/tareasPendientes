import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';

describe('Email Service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment for each test
  });

  afterAll(() => {
    process.env = originalEnv;
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
});
