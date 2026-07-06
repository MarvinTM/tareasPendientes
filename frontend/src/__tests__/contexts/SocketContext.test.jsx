import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SocketProvider, useSocket } from '../../contexts/SocketContext';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    disconnect: vi.fn(),
    id: 'mock-socket-id'
  }))
}));

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

import { io } from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';

describe('SocketContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    io.mockReturnValue({
      on: vi.fn(),
      disconnect: vi.fn(),
      id: 'mock-socket-id'
    });
  });

  describe('useSocket', () => {
    it('returns null when user is not authenticated', () => {
      useAuth.mockReturnValue({
        user: null, loading: false, login: vi.fn(), logout: vi.fn(), checkAuth: vi.fn()
      });

      const { result } = renderHook(() => useSocket(), { wrapper: SocketProvider });

      expect(result.current).toBeNull();
      expect(io).not.toHaveBeenCalled();
    });

    it('connects socket when user is authenticated', async () => {
      useAuth.mockReturnValue({
        user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true },
        loading: false, login: vi.fn(), logout: vi.fn(), checkAuth: vi.fn()
      });

      const { result } = renderHook(() => useSocket(), { wrapper: SocketProvider });

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(io).toHaveBeenCalledTimes(1);
    });

    it('disconnects when user becomes null', async () => {
      const mockDisconnect = vi.fn();
      io.mockReturnValue({
        on: vi.fn(),
        disconnect: mockDisconnect,
        id: 'socket-1'
      });

      useAuth.mockReturnValue({
        user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true },
        loading: false, login: vi.fn(), logout: vi.fn(), checkAuth: vi.fn()
      });

      const { result, rerender } = renderHook(() => useSocket(), { wrapper: SocketProvider });

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      useAuth.mockReturnValue({
        user: null, loading: false, login: vi.fn(), logout: vi.fn(), checkAuth: vi.fn()
      });

      rerender();

      await waitFor(() => {
        expect(result.current).toBeNull();
      });

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('cleans up socket on unmount', () => {
      const mockDisconnect = vi.fn();
      io.mockReturnValue({
        on: vi.fn(),
        disconnect: mockDisconnect,
        id: 'socket-2'
      });

      useAuth.mockReturnValue({
        user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true },
        loading: false, login: vi.fn(), logout: vi.fn(), checkAuth: vi.fn()
      });

      const { unmount } = renderHook(() => useSocket(), { wrapper: SocketProvider });

      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('uses VITE_API_URL when available for socket connection', async () => {
      vi.stubEnv('VITE_API_URL', 'https://api.example.com');

      useAuth.mockReturnValue({
        user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isApproved: true },
        loading: false, login: vi.fn(), logout: vi.fn(), checkAuth: vi.fn()
      });

      renderHook(() => useSocket(), { wrapper: SocketProvider });

      await waitFor(() => {
        expect(io).toHaveBeenCalledWith('https://api.example.com', expect.any(Object));
      });

      vi.unstubAllEnvs();
    });
  });
});
