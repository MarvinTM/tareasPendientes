import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import DevicesPage from '../../pages/DevicesPage';

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

vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => null,
}));

vi.mock('../../utils/iconMap', () => ({
  getGroupIcon: (name) => {
    const icons = {
      Lightbulb: () => <span data-testid="icon-Lightbulb">bulb</span>,
      Pool: () => <span data-testid="icon-Pool">pool</span>,
      Water: () => <span data-testid="icon-Water">water</span>,
    };
    return icons[name] || null;
  },
}));

const defaultDevices = [
  { id: 'dev-1', name: 'Luz Salón', room: 'Salón', group: 'lights', on: false, online: true },
  { id: 'dev-2', name: 'Bomba', room: 'Piscina', group: 'pool', on: true, online: true },
];

const defaultGroups = [
  { id: 'lights', name: 'Luces', icon: 'Lightbulb' },
  { id: 'pool', name: 'Piscina', icon: 'Pool' },
];

const defaultStatus = {};

const defaultPlans = [];

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}

describe('DevicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockImplementation((url) => {
      if (url === '/devices') return Promise.resolve({ data: defaultDevices });
      if (url === '/devices/groups') return Promise.resolve({ data: defaultGroups });
      if (url === '/devices/activation-status') return Promise.resolve({ data: defaultStatus });
      if (url === '/devices/activation-plans') return Promise.resolve({ data: defaultPlans });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('renders page title', async () => {
    renderWithProviders(<DevicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Dispositivos')).toBeInTheDocument();
    });
  });

  it('renders group sections with headers', async () => {
    renderWithProviders(<DevicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Luces')).toBeInTheDocument();
      const piscinaEls = screen.getAllByText('Piscina');
      expect(piscinaEls.length).toBeGreaterThan(0);
    });
  });

  it('renders device cards with name and room', async () => {
    renderWithProviders(<DevicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Luz Salón')).toBeInTheDocument();
      expect(screen.getByText('Salón')).toBeInTheDocument();
      expect(screen.getByText('Bomba')).toBeInTheDocument();
    });
  });

  it('shows group icons for each section', async () => {
    renderWithProviders(<DevicesPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('icon-Lightbulb').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('icon-Pool').length).toBeGreaterThan(0);
    });
  });

  it('shows activation plan dropdown when plans exist', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === '/devices') return Promise.resolve({ data: defaultDevices });
      if (url === '/devices/groups') return Promise.resolve({ data: defaultGroups });
      if (url === '/devices/activation-status') return Promise.resolve({ data: defaultStatus });
      if (url === '/devices/activation-plans') return Promise.resolve({
        data: [{ id: 'p-1', name: 'Plan', activationTime: '08:00', deactivationTime: '12:00' }],
      });
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithProviders(<DevicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Dispositivos')).toBeInTheDocument();
    });

    expect(mockApiGet).toHaveBeenCalledWith('/devices/activation-plans');
  });

  it('assigns a plan when dropdown value changes', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === '/devices') return Promise.resolve({ data: defaultDevices });
      if (url === '/devices/groups') return Promise.resolve({ data: defaultGroups });
      if (url === '/devices/activation-status') return Promise.resolve({ data: defaultStatus });
      if (url === '/devices/activation-plans') return Promise.resolve({
        data: [{ id: 'p-1', name: 'Plan', activationTime: '08:00', deactivationTime: '12:00' }],
      });
      return Promise.reject(new Error('Unknown URL'));
    });
    mockApiPost.mockResolvedValueOnce({
      data: { deviceId: 'dev-1', planId: 'p-1', plan: { id: 'p-1', name: 'Plan' } },
    });

    renderWithProviders(<DevicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Luz Salón')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    await userEvent.click(selects[0]);
    const option = screen.getByRole('option', { name: /Plan/ });
    await userEvent.click(option);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/devices/dev-1/activation', { planId: 'p-1' });
    });
  });

  it('shows offline devices with warning icon', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === '/devices') return Promise.resolve({
        data: [{ id: 'dev-3', name: 'Offline Device', group: 'lights', on: null, online: false }],
      });
      if (url === '/devices/groups') return Promise.resolve({ data: defaultGroups });
      if (url === '/devices/activation-status') return Promise.resolve({ data: defaultStatus });
      if (url === '/devices/activation-plans') return Promise.resolve({ data: defaultPlans });
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithProviders(<DevicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    });
  });
  describe('sensor devices', () => {
    const sensorDevice = {
      id: 'caudal-deposito',
      name: 'Entrada de agua al depósito',
      room: 'Depósito',
      group: 'water',
      kind: 'sensor',
      on: null,
      online: true,
      source: 'local',
      sensorStatus: { rateLpm: 12.5, todayLitres: 340, lastReadingAt: '2026-09-10T10:00:00.000Z' },
    };

    const groupsWithWater = [...defaultGroups, { id: 'water', name: 'Agua', icon: 'Water' }];
    const plans = [{ id: 'p-1', name: 'Plan', activationTime: '08:00', deactivationTime: '12:00' }];

    function mockWithSensor(device = sensorDevice) {
      mockApiGet.mockImplementation((url) => {
        if (url === '/devices') return Promise.resolve({ data: [...defaultDevices, device] });
        if (url === '/devices/groups') return Promise.resolve({ data: groupsWithWater });
        if (url === '/devices/activation-status') return Promise.resolve({ data: defaultStatus });
        if (url === '/devices/activation-plans') return Promise.resolve({ data: plans });
        return Promise.reject(new Error('Unknown URL'));
      });
    }

    it('renders the sensor as a read-only card with its current values', async () => {
      mockWithSensor();
      renderWithProviders(<DevicesPage />);

      await waitFor(() => {
        expect(screen.getByText('Entrada de agua al depósito')).toBeInTheDocument();
      });

      expect(screen.getByText('12.5 L/min')).toBeInTheDocument();
      expect(screen.getByText('340 L hoy')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Ver histórico de agua/ })).toHaveAttribute('href', '/agua');
    });

    it('shows neither a switch nor a plan selector for the sensor', async () => {
      mockWithSensor();
      renderWithProviders(<DevicesPage />);

      await waitFor(() => {
        expect(screen.getByText('Entrada de agua al depósito')).toBeInTheDocument();
      });

      // Only the two relay devices get a switch and a plan selector.
      expect(screen.getAllByRole('checkbox')).toHaveLength(2);
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
    });

    it('hides the rate when the sensor is offline', async () => {
      mockWithSensor({ ...sensorDevice, online: false });
      renderWithProviders(<DevicesPage />);

      await waitFor(() => {
        expect(screen.getByText('Entrada de agua al depósito')).toBeInTheDocument();
      });

      expect(screen.getByText('—')).toBeInTheDocument();
      expect(screen.getByText('340 L hoy')).toBeInTheDocument();
      expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    });
  });
});
