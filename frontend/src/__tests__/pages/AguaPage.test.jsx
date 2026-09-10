import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import AguaPage from '../../pages/AguaPage';

const theme = createTheme();

const mockApiGet = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => mockApiGet(...args),
  },
}));

const handlers = {};
const mockSocket = {
  on: vi.fn((event, handler) => { handlers[event] = handler; }),
  off: vi.fn(),
};

vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => mockSocket,
}));

const sensor = {
  id: 'caudal-deposito',
  name: 'Entrada de agua al depósito',
  room: 'Depósito',
  group: 'water',
  pulsesPerLitre: 450,
  online: true,
  rateLpm: 12.5,
  todayLitres: 340,
  lastReadingAt: '2026-09-10T10:00:00.000Z',
};

const history = [
  { time: '2026-09-10T09:55:00.000Z', litres: 3.2, avgRateLpm: 10 },
  { time: '2026-09-10T10:00:00.000Z', litres: null, avgRateLpm: null },
];

// 30 daily rows in the current natural month, 10 L each, so the "Este mes"
// total is exercised whatever the day the suite runs on.
const now = new Date();
const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const daily = Array.from({ length: 30 }, (_, i) => ({
  date: `${monthPrefix}-${String(i + 1).padStart(2, '0')}`,
  time: `${monthPrefix}-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
  litres: 10,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}><AguaPage /></ThemeProvider>
    </MemoryRouter>
  );
}

describe('AguaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockImplementation((url) => {
      if (url === '/flow/sensors') return Promise.resolve({ data: [sensor] });
      if (url.includes('/history')) return Promise.resolve({ data: history });
      if (url.includes('/daily')) return Promise.resolve({ data: daily });
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });
  });

  it('renders the sensor metrics', async () => {
    renderPage();

    // 7 days × 10 L, and 30 × 10 L for the month — both come from the daily
    // series, which loads after the sensor list.
    await waitFor(() => {
      expect(screen.getByText('70 L')).toBeInTheDocument();
      expect(screen.getByText('300 L')).toBeInTheDocument();
    });

    expect(screen.getByText('Entrada de agua al depósito')).toBeInTheDocument();
    expect(screen.getByText('12.5 L/min')).toBeInTheDocument();
    expect(screen.getByText('340 L')).toBeInTheDocument();
    expect(screen.getByText('En línea')).toBeInTheDocument();
  });

  it('requests the 24h history and the 30-day totals for the sensor', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/flow/caudal-deposito/history?range=24h');
      expect(mockApiGet).toHaveBeenCalledWith('/flow/caudal-deposito/daily?days=30');
    });
  });

  it('shows an empty state when no sensor is configured', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === '/flow/sensors') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No hay caudalímetros configurados.')).toBeInTheDocument();
    });
  });

  it('shows an error when the sensor list cannot be loaded', async () => {
    mockApiGet.mockImplementation(() => Promise.reject(new Error('boom')));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No se pudieron cargar los sensores de agua')).toBeInTheDocument();
    });
  });

  it('reports the sensor as offline without a rate', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === '/flow/sensors') {
        return Promise.resolve({ data: [{ ...sensor, online: false, rateLpm: null }] });
      }
      if (url.includes('/history')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    renderPage();

    await waitFor(() => {
      // Once in the header chip, once as the metric card's secondary line.
      expect(screen.getAllByText('Sin conexión')).toHaveLength(2);
    });
    // Rate, last 7 days and this month have nothing to show; today's total does.
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getByText('340 L')).toBeInTheDocument();
    expect(screen.getAllByText('No hay lecturas del caudalímetro todavía')).toHaveLength(2);
  });

  it('updates the live values from the flow:data socket event', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('12.5 L/min')).toBeInTheDocument();
    });

    act(() => {
      handlers['flow:data']([{
        sensorId: 'caudal-deposito',
        online: true,
        rateLpm: 20.4,
        todayLitres: 512,
        lastReadingAt: '2026-09-10T10:00:30.000Z',
      }]);
    });

    await waitFor(() => {
      expect(screen.getByText('20.4 L/min')).toBeInTheDocument();
      expect(screen.getByText('512 L')).toBeInTheDocument();
    });
  });

  it('ignores flow:data events for other sensors', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('12.5 L/min')).toBeInTheDocument();
    });

    act(() => {
      handlers['flow:data']([{ sensorId: 'otro-sensor', online: true, rateLpm: 99 }]);
    });

    expect(screen.getByText('12.5 L/min')).toBeInTheDocument();
  });
});
