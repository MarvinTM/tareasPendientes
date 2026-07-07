import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import RiegoEventsPage from '../../pages/RiegoEventsPage';

const theme = createTheme();

const mockApiGet = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => mockApiGet(...args),
  },
}));

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}

const defaultEvents = [
  { id: 'e-1', phaseId: 'fase-1', phaseName: 'Jardín', event: 'STARTED', stopReason: null, error: null, timestamp: '2025-01-01T12:00:00Z', user: null },
  { id: 'e-2', phaseId: 'fase-1', phaseName: 'Jardín', event: 'STOPPED', stopReason: 'timeout', error: null, timestamp: '2025-01-01T11:00:00Z', user: null },
  { id: 'e-3', phaseId: 'fase-2', phaseName: 'Patio', event: 'ERROR', stopReason: null, error: 'Shelly ON failed', timestamp: '2025-01-01T10:00:00Z', user: null },
];

describe('RiegoEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({
      data: {
        events: defaultEvents,
        nextCursor: null,
        hasMore: false,
      },
    });
  });

  it('renders page title', async () => {
    renderWithProviders(<RiegoEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('Histórico de Riegos')).toBeInTheDocument();
    });
  });

  it('renders STARTED events', async () => {
    renderWithProviders(<RiegoEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('Iniciada')).toBeInTheDocument();
      const jardinEls = screen.getAllByText('Jardín');
      expect(jardinEls.length).toBe(2);
    });
  });

  it('renders STOPPED events with stop reason', async () => {
    renderWithProviders(<RiegoEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('Detenida')).toBeInTheDocument();
      expect(screen.getByText('Por tiempo')).toBeInTheDocument();
    });
  });

  it('renders ERROR events with error message', async () => {
    renderWithProviders(<RiegoEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Shelly ON failed')).toBeInTheDocument();
    });
  });

  it('shows user name when present', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        events: [{
          id: 'e-4', phaseId: 'fase-1', phaseName: 'Jardín', event: 'STOPPED',
          stopReason: 'manual', error: null, timestamp: '2025-01-01T09:00:00Z',
          user: { id: 'usr-1', name: 'John' },
        }],
        nextCursor: null,
        hasMore: false,
      },
    });

    renderWithProviders(<RiegoEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('por John')).toBeInTheDocument();
    });
  });

  it('shows empty state when no events', async () => {
    mockApiGet.mockResolvedValue({
      data: { events: [], nextCursor: null, hasMore: false },
    });

    renderWithProviders(<RiegoEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('No hay eventos registrados.')).toBeInTheDocument();
    });
  });

  it('shows end of history when hasMore is false', async () => {
    mockApiGet.mockResolvedValue({
      data: { events: defaultEvents, nextCursor: null, hasMore: false },
    });

    renderWithProviders(<RiegoEventsPage />);
    await waitFor(() => {
      expect(screen.getByText('— Fin del historial —')).toBeInTheDocument();
    });
  });
});
