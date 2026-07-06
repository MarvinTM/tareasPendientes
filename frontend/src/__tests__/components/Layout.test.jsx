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

function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
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

  it('renders navigation items for active tareas module', () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />, { route: '/tareas' });
    expect(screen.getByText('Tablero')).toBeInTheDocument();
    expect(screen.getByText('Recurrentes')).toBeInTheDocument();
    expect(screen.getByText('Puntuación')).toBeInTheDocument();
  });

  it('does not show admin items for non-admin users', () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />, { route: '/admin' });
    expect(screen.queryByText('Categorías')).not.toBeInTheDocument();
  });

  it('shows admin items for admin users when on admin route', () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'admin@test.com', name: 'Admin', isAdmin: true }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />, { route: '/admin' });
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Categorías')).toBeInTheDocument();
  });

  it('renders user avatar', () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />);
    expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
  });

  it('renders app logos in drawer and appbar', () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />);
    const logos = screen.getAllByTestId('app-logo');
    expect(logos).toHaveLength(2);
  });

  it('navigates to /tareas when logo/title is clicked', async () => {
    useAuth.mockReturnValue({ user: { id: 'usr-1', email: 'test@test.com', name: 'Test', isAdmin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    renderWithProviders(<Layout />);
    await userEvent.click(screen.getByText('Tareas Pendientes'));
    expect(mockNavigate).toHaveBeenCalledWith('/tareas');
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
