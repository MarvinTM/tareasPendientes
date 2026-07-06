import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import RiegoPage from '../../pages/RiegoPage';

const theme = createTheme();

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => mockApiGet(...args),
    post: (...args) => mockApiPost(...args),
    delete: (...args) => mockApiDelete(...args),
  },
}));

const mockSocketOn = vi.fn();
const mockSocketOff = vi.fn();

vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => ({
    on: mockSocketOn,
    off: mockSocketOff,
  }),
}));

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}

const defaultState = {
  current: null,
  queue: [],
  phases: [
    { id: 'fase-1', name: 'Jardín' },
    { id: 'fase-2', name: 'Patio' },
  ],
  durationMemory: { 'fase-1': 10, 'fase-2': 5 },
};

const defaultPlans = [
  { id: 'p-1', name: 'Plan 1', phases: [{ phaseId: 'fase-1', durationMin: 10 }, { phaseId: 'fase-2', durationMin: 5 }] },
];

describe('RiegoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({ 'fase-1': 10, 'fase-2': 5 })),
      setItem: vi.fn(),
      clear: vi.fn(),
    });
    mockApiGet.mockImplementation((url) => {
      if (url === '/riego/status') return Promise.resolve({ data: defaultState });
      if (url === '/riego/plans') return Promise.resolve({ data: defaultPlans });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('renders page title', async () => {
    renderWithProviders(<RiegoPage />);
    await waitFor(() => {
      expect(screen.getByText('Riego')).toBeInTheDocument();
    });
  });

  it('renders phase cards', async () => {
    renderWithProviders(<RiegoPage />);
    await waitFor(() => {
      expect(screen.getByText('Jardín')).toBeInTheDocument();
      expect(screen.getByText('Patio')).toBeInTheDocument();
    });
  });

  it('shows "Cola vacía" when empty', async () => {
    renderWithProviders(<RiegoPage />);
    await waitFor(() => {
      expect(screen.getByText('Cola vacía')).toBeInTheDocument();
    });
  });

  it('activates a phase on button click', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { ...defaultState } });

    renderWithProviders(<RiegoPage />);
    await waitFor(() => {
      expect(screen.getByText('Jardín')).toBeInTheDocument();
    });

    const buttons = screen.getAllByText('Activar');
    await userEvent.click(buttons[0]);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/riego/start', {
        phaseId: 'fase-1',
        durationMin: 10,
      });
    });
  });

  it('shows active queue item with countdown', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === '/riego/status') return Promise.resolve({
        data: {
          ...defaultState,
          current: { queueId: 'q-1', phaseId: 'fase-1', name: 'Jardín', durationMin: 10, remaining: 500 },
          queue: [],
        },
      });
      if (url === '/riego/plans') return Promise.resolve({ data: [] });
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithProviders(<RiegoPage />);
    await waitFor(() => {
      expect(screen.getByText('Quedan 8m 20s')).toBeInTheDocument();
    });
  });

  it('stops current phase', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === '/riego/status') return Promise.resolve({
        data: { ...defaultState, current: { queueId: 'q-1', phaseId: 'fase-1', name: 'Jardín', durationMin: 10, remaining: 500 }, queue: [] },
      });
      if (url === '/riego/plans') return Promise.resolve({ data: [] });
      return Promise.reject(new Error('Unknown URL'));
    });
    mockApiPost.mockResolvedValueOnce({ data: {} });

    renderWithProviders(<RiegoPage />);
    await waitFor(() => {
      expect(screen.getByText('Quedan 8m 20s')).toBeInTheDocument();
    });

    const stopButtons = screen.getAllByTestId('StopIcon');
    await userEvent.click(stopButtons[0]);

    expect(mockApiPost).toHaveBeenCalledWith('/riego/stop');
  });

  it('removes pending queue item', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === '/riego/status') return Promise.resolve({
        data: {
          ...defaultState,
          current: { queueId: 'q-1', phaseId: 'fase-1', name: 'Jardín', durationMin: 10, remaining: 500 },
          queue: [{ queueId: 'q-2', phaseId: 'fase-2', name: 'Patio', durationMin: 5 }],
        },
      });
      if (url === '/riego/plans') return Promise.resolve({ data: [] });
      return Promise.reject(new Error('Unknown URL'));
    });
    mockApiDelete.mockResolvedValueOnce({ data: {} });

    renderWithProviders(<RiegoPage />);
    await waitFor(() => {
      expect(screen.getByText('Quedan 8m 20s')).toBeInTheDocument();
    });

    const closeButtons = screen.getAllByTestId('CloseIcon');
    await userEvent.click(closeButtons[0]);

    expect(mockApiDelete).toHaveBeenCalledWith('/riego/queue/q-2');
  });

  it('renders saved plans', async () => {
    renderWithProviders(<RiegoPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan 1')).toBeInTheDocument();
    });
  });

  it('opens confirmation dialog on plan trigger', async () => {
    renderWithProviders(<RiegoPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan 1')).toBeInTheDocument();
    });

    const triggerButtons = screen.getAllByText('Activar plan');
    await userEvent.click(triggerButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('¿Añadir plan "Plan 1" (2 fases, 15 min) a la cola?')).toBeInTheDocument();
    });
  });

  it('listens to riego:updated socket event', async () => {
    renderWithProviders(<RiegoPage />);
    await waitFor(() => {
      expect(screen.getByText('Jardín')).toBeInTheDocument();
    });

    expect(mockSocketOn).toHaveBeenCalledWith('riego:updated', expect.any(Function));
  });

  it('activate button is enabled by default with default duration', async () => {
    renderWithProviders(<RiegoPage />);
    await waitFor(() => {
      expect(screen.getByText('Jardín')).toBeInTheDocument();
    });

    const buttons = screen.getAllByText('Activar');
    expect(buttons[0]).not.toBeDisabled();
  });
});
