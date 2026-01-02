import '@testing-library/jest-dom';

// Mock environment variables
window.import = {
  meta: {
    env: {
      VITE_API_URL: 'http://localhost:3001',
      VITE_GOOGLE_CLIENT_ID: 'test-client-id'
    }
  }
};

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:5173',
    hostname: 'localhost',
    protocol: 'http:',
    href: 'http://localhost:5173'
  },
  writable: true
});
