import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import ActivationPlansPage from '../../pages/ActivationPlansPage';

const theme = createTheme();

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => mockApiGet(...args),
    post: (...args) => mockApiPost(...args),
    patch: (...args) => mockApiPatch(...args),
    delete: (...args) => mockApiDelete(...args),
  },
}));

vi.mock('suncalc', () => ({
  getTimes: vi.fn(() => ({
    sunrise: new Date(2000, 0, 1, 7, 15),
    sunset: new Date(2000, 0, 1, 21, 30),
  })),
}));

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}

const defaultPlans = [
  { id: 'p-1', name: 'Morning', activationTime: '08:00', deactivationTime: '12:00', activationMode: 'fixed', deactivationMode: 'fixed' },
];

describe('ActivationPlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ data: defaultPlans });
  });

  it('renders page title', async () => {
    renderWithProviders(<ActivationPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Planes de Activación')).toBeInTheDocument();
    });
  });

  it('renders plan list with fixed mode times', async () => {
    renderWithProviders(<ActivationPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Morning')).toBeInTheDocument();
      expect(screen.getByText('08:00 — 12:00')).toBeInTheDocument();
    });
  });

  it('renders plan list with sunrise/sunset labels', async () => {
    mockApiGet.mockResolvedValue({
      data: [{ id: 'p-2', name: 'Sun Plan', activationTime: '00:00', deactivationTime: '00:00', activationMode: 'sunrise', deactivationMode: 'sunset' }],
    });

    renderWithProviders(<ActivationPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Sun Plan')).toBeInTheDocument();
      expect(screen.getByText('Amanecer (~07:15) — Anochecer (~21:30)')).toBeInTheDocument();
    });
  });

  it('shows empty state', async () => {
    mockApiGet.mockResolvedValue({ data: [] });

    renderWithProviders(<ActivationPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('No hay planes de activación.')).toBeInTheDocument();
    });
  });

  it('opens create dialog', async () => {
    renderWithProviders(<ActivationPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Morning')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Nuevo Plan'));

    await waitFor(() => {
      expect(screen.getByText('Nuevo Plan de Activación')).toBeInTheDocument();
      expect(screen.getByText('Guardar')).toBeInTheDocument();
    });
  });

  it('saves new plan with fixed modes', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { id: 'new', name: 'Evening', activationTime: '18:00', deactivationTime: '22:00', activationMode: 'fixed', deactivationMode: 'fixed' } });

    renderWithProviders(<ActivationPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Morning')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Nuevo Plan'));
    await waitFor(() => {
      expect(screen.getByText('Nuevo Plan de Activación')).toBeInTheDocument();
    });

    const nameInput = screen.getByRole('textbox', { name: /nombre/i });
    await userEvent.type(nameInput, 'Evening');

    const timeInputs = screen.getAllByLabelText(/hora/i);
    await userEvent.type(timeInputs[0], '18:00');
    await userEvent.type(timeInputs[1], '22:00');

    mockApiGet.mockResolvedValue({ data: [...defaultPlans, { id: 'new', name: 'Evening', activationTime: '18:00', deactivationTime: '22:00', activationMode: 'fixed', deactivationMode: 'fixed' }] });

    await userEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/devices/activation-plans', {
        name: 'Evening',
        activationTime: '18:00',
        deactivationTime: '22:00',
        activationMode: 'fixed',
        deactivationMode: 'fixed',
      });
    });
  });

  it('edits existing plan', async () => {
    renderWithProviders(<ActivationPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Morning')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTestId('EditIcon');
    await userEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Editar Plan')).toBeInTheDocument();
    });
  });

  it('deletes a plan', async () => {
    mockApiDelete.mockResolvedValueOnce({ data: {} });

    renderWithProviders(<ActivationPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Morning')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/¿Estás seguro de eliminar el plan/)).toBeInTheDocument();
    });

    mockApiGet.mockResolvedValue({ data: [] });
    await userEvent.click(screen.getByText('Eliminar'));

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith('/devices/activation-plans/p-1');
    });
  });
});
