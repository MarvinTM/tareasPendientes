// Jest setup file
// Set up environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.ADMIN_EMAILS = 'admin@test.com,superadmin@test.com';
process.env.NODE_ENV = 'test';

// Suppress console noise from expected error-path tests
const noop = () => {};
console.error = noop;
console.log = noop;
console.warn = noop;
