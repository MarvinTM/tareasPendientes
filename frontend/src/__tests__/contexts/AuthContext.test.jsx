import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

import api from '../../services/api';

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = '';
  });

  describe('useAuth hook', () => {
    it('throws when used outside AuthProvider', () => {
      expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within an AuthProvider');
    });

    it('starts with loading=true and user=null', () => {
      api.get.mockResolvedValue({ data: { authenticated: false } });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
    });

    it('sets user when checkAuth succeeds with authenticated:true', async () => {
      const user = { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true, isAdmin: false };
      api.get.mockResolvedValue({ data: { authenticated: true, user } });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(user);
    });

    it('sets loading=false when checkAuth returns unauthenticated', async () => {
      api.get.mockResolvedValue({ data: { authenticated: false } });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });

    it('sets loading=false when checkAuth fails', async () => {
      api.get.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });

    it('login constructs correct URL and redirects', () => {
      api.get.mockResolvedValue({ data: { authenticated: false } });

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      act(() => {
        result.current.login();
      });

      expect(window.location.href).toContain('/api/auth/google');
      expect(window.location.href).toContain('redirect_origin=');
      expect(window.location.href).toContain('localhost');
    });

    it('logout calls API and clears user', async () => {
      const user = { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true, isAdmin: false };
      api.get.mockResolvedValueOnce({ data: { authenticated: true, user } });
      api.post.mockResolvedValueOnce({ data: { message: 'Logged out' } });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.user).not.toBeNull();

      await act(async () => {
        await result.current.logout();
      });

      expect(api.post).toHaveBeenCalledWith('/auth/logout');
      expect(result.current.user).toBeNull();
    });

    it('logout handles API failure gracefully', async () => {
      const user = { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true, isAdmin: false };
      api.get.mockResolvedValueOnce({ data: { authenticated: true, user } });
      api.post.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toEqual(user);
    });

    it('checkAuth updates user on subsequent calls', async () => {
      api.get.mockResolvedValueOnce({ data: { authenticated: false } });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.user).toBeNull();

      const newUser = { id: 'usr-2', email: 'new@test.com', name: 'New', isApproved: true, isAdmin: true };
      api.get.mockResolvedValueOnce({ data: { authenticated: true, user: newUser } });

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.user).toEqual(newUser);
    });
  });
});
