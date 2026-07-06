import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../../components/Layout';

const theme = createTheme();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: vi.fn()
}));

vi.mock('../../components/UserAvatar', () => ({
  default: () => <div data-testid="user-avatar" />
}));

vi.mock('../../components/AppLogo', () => ({
  default: () => <div data-testid="app-logo" />
}));

import { useAuth } from '../../contexts/AuthContext';

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders app title', () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />);
    expect(screen.getByText('Tareas Pendientes')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />);
    expect(screen.getByText('Recurrentes')).toBeInTheDocument();
    expect(screen.getByText('Puntuación')).toBeInTheDocument();
    expect(screen.getByText('Historial')).toBeInTheDocument();
  });

  it('does not show admin items for non-admin users', () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />);
    expect(screen.queryByText('Categorías')).not.toBeInTheDocument();
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
  });

  it('shows admin items for admin users', () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'admin@test.com', name: 'Admin', isAdmin: true }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />);
    expect(screen.getByText('Categorías')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('renders user avatar', () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />);
    expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
  });

  it('renders app logo', () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />);
    expect(screen.getByTestId('app-logo')).toBeInTheDocument();
  });

  it('navigates to home when logo/title is clicked', async () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />);
    await userEvent.click(screen.getByText('Tareas Pendientes'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('calls logout and navigates to login on logout', async () => {
    const mockLogout = vi.fn();
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: mockLogout });
    renderWithProviders(<Layout />);

    await userEvent.click(screen.getByTestId('user-avatar'));
    await userEvent.click(screen.getByText('Cerrar sesión'));

    expect(mockLogout).toHaveBeenCalled();
  });
});
