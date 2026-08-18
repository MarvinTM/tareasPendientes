import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import PortadaPage from '../../pages/PortadaPage';

const theme = createTheme();
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => mockApiGet(...args),
    post: (...args) => mockApiPost(...args),
  },
}));

vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => null,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <PortadaPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('PortadaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('renders the three overview sections and only featured devices', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Puerta Garaje')).toBeInTheDocument();
      expect(screen.getByText('Paneles Solares')).toBeInTheDocument();
      expect(screen.getByText('Riego apagado')).toBeInTheDocument();
    });

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.getByText(/2[.,]000 W/)).toBeInTheDocument();
  });

  it('uses the pulse action for a featured pulse device', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Puerta Garaje')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Puerta Garaje: accionar/i }));

    expect(mockApiPost).toHaveBeenCalledWith('/devices/puerta-garaje/pulse');
  });
});
