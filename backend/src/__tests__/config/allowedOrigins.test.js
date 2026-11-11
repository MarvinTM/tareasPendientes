import { describe, it, expect, afterEach } from '@jest/globals';
import { isAllowedOrigin, safeRedirectTarget } from '../../config/allowedOrigins.js';

describe('allowedOrigins', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;
  afterEach(() => {
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  });

  describe('isAllowedOrigin', () => {
    it('allows local development origins', () => {
      expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
      expect(isAllowedOrigin('http://192.168.1.240:5173')).toBe(true);
      expect(isAllowedOrigin('http://192.168.1.10.nip.io:5173')).toBe(true);
    });

    it('allows FRONTEND_URL and rejects other origins', () => {
      process.env.FRONTEND_URL = 'https://villacautela.com';
      expect(isAllowedOrigin('https://villacautela.com')).toBe(true);
      expect(isAllowedOrigin('https://evil.example')).toBe(false);
    });
  });

  describe('safeRedirectTarget', () => {
    it('accepts a path on the host serving the request', () => {
      expect(safeRedirectTarget('https://villacautela.com/roadmap/', 'villacautela.com'))
        .toBe('https://villacautela.com/roadmap/');
    });

    it('accepts the plain origin used by the Tareas frontend', () => {
      expect(safeRedirectTarget('https://villacautela.com', 'villacautela.com'))
        .toBe('https://villacautela.com/');
    });

    it('accepts allowed dev origins on a different port', () => {
      expect(safeRedirectTarget('http://localhost:5173', 'localhost:3001'))
        .toBe('http://localhost:5173/');
    });

    it('rejects foreign hosts, look-alikes and non-http schemes', () => {
      expect(safeRedirectTarget('https://evil.example/', 'villacautela.com')).toBeNull();
      expect(safeRedirectTarget('https://villacautela.com.evil.example/', 'villacautela.com')).toBeNull();
      expect(safeRedirectTarget('javascript:alert(1)', 'villacautela.com')).toBeNull();
      expect(safeRedirectTarget('not a url', 'villacautela.com')).toBeNull();
      expect(safeRedirectTarget(undefined, 'villacautela.com')).toBeNull();
    });
  });
});
