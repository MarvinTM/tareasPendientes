import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import LightsPage from '../../pages/LightsPage';

const theme = createTheme();

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => mockApiGet(...args),
    post: (...args) => mockApiPost(...args),
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

const onlineDevice = {
  id: 'dev-1',
  name: 'Luz del salón',
  room: 'Salón',
  on: true,
  online: true,
};

const offlineDevice = {
  id: 'dev-2',
  name: 'Luz del baño',
  room: 'Baño',
  on: null,
  online: false,
};

describe('LightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ data: [onlineDevice, offlineDevice] });
  });

  it('renders page title', async () => {
    renderWithProviders(<LightsPage />);
    await waitFor(() => {
      expect(screen.getByText('Luces')).toBeInTheDocument();
    });
  });

  it('shows loading spinner initially', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<LightsPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders device cards with names and rooms', async () => {
    renderWithProviders(<LightsPage />);
    await waitFor(() => {
      expect(screen.getByText('Luz del salón')).toBeInTheDocument();
      expect(screen.getByText('Salón')).toBeInTheDocument();
      expect(screen.getByText('Luz del baño')).toBeInTheDocument();
      expect(screen.getByText('Baño')).toBeInTheDocument();
    });
  });

  it('shows Sin conexión for offline devices', async () => {
    renderWithProviders(<LightsPage />);
    await waitFor(() => {
      expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    });
  });

  it('disables switch for offline devices', async () => {
    renderWithProviders(<LightsPage />);
    await waitFor(() => {
      const switches = screen.getAllByRole('checkbox');
      const offlineSwitch = switches[1];
      expect(offlineSwitch).toBeDisabled();
    });
  });

  it('calls toggle API when switch is clicked', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { id: 'dev-1', on: false } });

    renderWithProviders(<LightsPage />);
    await waitFor(() => {
      expect(screen.getByText('Luz del salón')).toBeInTheDocument();
    });

    const switches = screen.getAllByRole('checkbox');
    await userEvent.click(switches[0]);

    expect(mockApiPost).toHaveBeenCalledWith('/devices/dev-1/toggle');
  });

  it('updates switch state after successful toggle', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { id: 'dev-1', on: false } });

    renderWithProviders(<LightsPage />);
    await waitFor(() => {
      expect(screen.getByText('Luz del salón')).toBeInTheDocument();
    });

    const switches = screen.getAllByRole('checkbox');
    expect(switches[0]).toBeChecked();

    await userEvent.click(switches[0]);

    await waitFor(() => {
      const updatedSwitches = screen.getAllByRole('checkbox');
      expect(updatedSwitches[0]).not.toBeChecked();
    });
  });

  it('shows error snackbar on toggle failure', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<LightsPage />);
    await waitFor(() => {
      expect(screen.getByText('Luz del salón')).toBeInTheDocument();
    });

    const switches = screen.getAllByRole('checkbox');
    await userEvent.click(switches[0]);

    await waitFor(() => {
      expect(screen.getByText('Error al cambiar el dispositivo')).toBeInTheDocument();
    });
  });

  it('shows error alert when fetch fails', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<LightsPage />);
    await waitFor(() => {
      expect(screen.getByText('Error al cargar los dispositivos')).toBeInTheDocument();
    });
  });

  it('shows empty state when no devices', async () => {
    mockApiGet.mockResolvedValueOnce({ data: [] });

    renderWithProviders(<LightsPage />);
    await waitFor(() => {
      expect(screen.getByText('No hay dispositivos configurados.')).toBeInTheDocument();
    });
  });

  it('listens to device:updated socket event', async () => {
    renderWithProviders(<LightsPage />);
    await waitFor(() => {
      expect(screen.getByText('Luz del salón')).toBeInTheDocument();
    });

    expect(mockSocketOn).toHaveBeenCalledWith('device:updated', expect.any(Function));
  });

  it('starts polling when device is offline', async () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    renderWithProviders(<LightsPage />);

    await waitFor(() => {
      expect(screen.getByText('Luz del baño')).toBeInTheDocument();
    });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('cleans up polling interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderWithProviders(<LightsPage />);

    await waitFor(() => {
      expect(screen.getByText('Luz del baño')).toBeInTheDocument();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });
});
