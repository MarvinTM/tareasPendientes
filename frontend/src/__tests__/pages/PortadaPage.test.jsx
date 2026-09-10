import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import PortadaPage from '../../pages/PortadaPage';

const theme = createTheme();
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const originalMatchMedia = window.matchMedia;

vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => mockApiGet(...args),
    post: (...args) => mockApiPost(...args),
  },
}));

vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => null,
}));

function mockLandscape(matches) {
  window.matchMedia = vi.fn(() => ({
    matches,
    media: '(min-width:900px)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderPage(context = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route element={<Outlet context={context} />}>
            <Route path="/" element={<PortadaPage />} />
          </Route>
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('PortadaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLandscape(false);
    mockApiGet.mockImplementation((url) => {
      if (url === '/devices') {
        return Promise.resolve({ data: [
          { id: 'puerta-garaje', name: 'Puerta Garaje', group: 'garaje', controlMode: 'pulse', showOnHome: true, online: true },
          { id: 'hidden', name: 'Hidden', group: 'lights', controlMode: 'toggle', showOnHome: false, on: false, online: true },
        ] });
      }
      if (url === '/ingestion/latest') {
        return Promise.resolve({ data: [
          { inverterId: 'master', timestamp: '2026-01-01T10:00:00.000Z', pvPower: 1200, meterPower: -300, battPower: 100, battSoc: 80 },
          { inverterId: 'slave', timestamp: '2026-01-01T10:00:00.000Z', pvPower: 800 },
        ] });
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });
    mockApiPost.mockResolvedValue({ data: { triggered: true } });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders the three overview sections and only featured devices', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Puerta Garaje')).toBeInTheDocument();
      expect(screen.getByText('Paneles Solares')).toBeInTheDocument();
      expect(screen.getByText('Riego apagado')).toBeInTheDocument();
    });

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.queryByText('Tus tareas')).not.toBeInTheDocument();
    expect(screen.getByText(/2[.,]000 W/)).toBeInTheDocument();
  });

  it('uses the pulse action for a featured pulse device', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Puerta Garaje')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Puerta Garaje: accionar/i }));

    expect(mockApiPost).toHaveBeenCalledWith('/devices/puerta-garaje/pulse');
  });

  it('shows only the current user pending tasks in landscape', async () => {
    mockLandscape(true);
    mockApiGet.mockImplementation((url) => {
      if (url === '/devices') return Promise.resolve({ data: [] });
      if (url === '/ingestion/latest') return Promise.resolve({ data: [] });
      if (url === '/tasks') {
        return Promise.resolve({ data: {
          Nueva: [
            { id: 'mine-1', title: 'Recoger paquete', status: 'Nueva', assignedTo: { id: 'user-1' }, category: { emoji: '📦' } },
            { id: 'other-1', title: 'Tarea de otra persona', status: 'Nueva', assignedTo: { id: 'user-2' } },
          ],
          EnProgreso: [
            { id: 'mine-2', title: 'Revisar garaje', status: 'EnProgreso', assignedTo: { id: 'user-1' } },
          ],
          Completada: [],
        } });
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    renderPage({ user: { id: 'user-1' } });

    await waitFor(() => {
      expect(screen.getByText('Tus tareas')).toBeInTheDocument();
      expect(screen.getByText('Recoger paquete')).toBeInTheDocument();
      expect(screen.getByText('Revisar garaje')).toBeInTheDocument();
    });

    expect(screen.getByText('Tienes 2 tareas pendientes.')).toBeInTheDocument();
    expect(screen.queryByText('Tarea de otra persona')).not.toBeInTheDocument();
  });
  it('shows a featured flow sensor with its current values', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === '/devices') {
        return Promise.resolve({ data: [
          {
            id: 'caudal-deposito',
            name: 'Entrada de agua al depósito',
            group: 'water',
            kind: 'sensor',
            showOnHome: true,
            on: null,
            online: true,
            source: 'local',
            sensorStatus: { rateLpm: 12.5, todayLitres: 340, lastReadingAt: '2026-09-10T10:00:00.000Z' },
          },
        ] });
      }
      if (url === '/ingestion/latest') return Promise.resolve({ data: [] });
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('12.5 L/min')).toBeInTheDocument();
    });

    expect(screen.getByText('340 L hoy')).toBeInTheDocument();
    // Read-only: it opens the Agua module instead of switching anything.
    expect(screen.getByRole('button', { name: /ver histórico de agua/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /encender|apagar/i })).not.toBeInTheDocument();
  });

  it('shows a featured flow sensor as offline without a rate', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === '/devices') {
        return Promise.resolve({ data: [
          {
            id: 'caudal-deposito',
            name: 'Entrada de agua al depósito',
            group: 'water',
            kind: 'sensor',
            showOnHome: true,
            on: null,
            online: false,
            source: 'unknown',
            sensorStatus: { rateLpm: null, todayLitres: null, lastReadingAt: null },
          },
        ] });
      }
      if (url === '/ingestion/latest') return Promise.resolve({ data: [] });
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    });

    expect(screen.getByText('— hoy')).toBeInTheDocument();
  });
});
