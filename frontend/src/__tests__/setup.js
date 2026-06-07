import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.stubEnv('VITE_API_URL', 'http://localhost:3001');
vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');

Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:5173',
    hostname: 'localhost',
    protocol: 'http:',
    href: 'http://localhost:5173'
  },
  writable: true
});
