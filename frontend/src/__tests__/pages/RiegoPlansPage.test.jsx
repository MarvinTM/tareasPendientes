import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import RiegoPlansPage from '../../pages/RiegoPlansPage';

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

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}

const defaultPlans = [
  { id: 'p-1', name: 'Plan Matinal', phases: [{ phaseId: 'fase-1', durationMin: 10 }, { phaseId: 'fase-2', durationMin: 5 }] },
];

const defaultStatus = {
  current: null,
  queue: [],
  phases: [
    { id: 'fase-1', name: 'Jardín' },
    { id: 'fase-2', name: 'Patio' },
  ],
  durationMemory: {},
};

describe('RiegoPlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockImplementation((url) => {
      if (url === '/riego/plans') return Promise.resolve({ data: defaultPlans });
      if (url === '/riego/status') return Promise.resolve({ data: defaultStatus });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('renders page title', async () => {
    renderWithProviders(<RiegoPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Planes de Riego')).toBeInTheDocument();
    });
  });

  it('renders plan list', async () => {
    renderWithProviders(<RiegoPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan Matinal')).toBeInTheDocument();
      expect(screen.getByText('2 fases · Total: 15 min')).toBeInTheDocument();
    });
  });

  it('shows empty state when no plans', async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === '/riego/plans') return Promise.resolve({ data: [] });
      if (url === '/riego/status') return Promise.resolve({ data: defaultStatus });
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithProviders(<RiegoPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('No hay planes guardados.')).toBeInTheDocument();
    });
  });

  it('opens create dialog', async () => {
    renderWithProviders(<RiegoPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan Matinal')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Nuevo Plan'));

    await waitFor(() => {
      expect(screen.getByText('Nuevo Plan de Riego')).toBeInTheDocument();
      expect(screen.getByText('Guardar')).toBeInTheDocument();
    });
  });

  it('adds phase to plan form', async () => {
    renderWithProviders(<RiegoPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan Matinal')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Nuevo Plan'));
    await waitFor(() => {
      expect(screen.getByText('Nuevo Plan de Riego')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Añadir fase'));

    await waitFor(() => {
      expect(screen.getByText('Añadir fase')).toBeInTheDocument();
    });
  });

  it('saves new plan', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { id: 'new', name: 'Test', phases: [] } });

    renderWithProviders(<RiegoPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan Matinal')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Nuevo Plan'));
    await waitFor(() => {
      expect(screen.getByText('Nuevo Plan de Riego')).toBeInTheDocument();
    });

    const nameInput = screen.getByRole('textbox', { name: /nombre/i });
    await userEvent.type(nameInput, 'Test');
    await userEvent.click(screen.getByText('Añadir fase'));

    mockApiGet.mockResolvedValueOnce({ data: [...defaultPlans, { id: 'new', name: 'Test', phases: [] }] });
    mockApiGet.mockResolvedValueOnce({ data: defaultStatus });

    await userEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/riego/plans', {
        name: 'Test',
        phases: [{ phaseId: 'fase-1', durationMin: 10 }],
      });
    });
  });

  it('deletes plan', async () => {
    mockApiDelete.mockResolvedValueOnce({ data: {} });
    // Return plans first time, empty after delete refetch
    let callCount = 0;
    mockApiGet.mockImplementation((url) => {
      if (url === '/riego/plans') {
        callCount++;
        return Promise.resolve({ data: callCount === 1 ? defaultPlans : [] });
      }
      if (url === '/riego/status') return Promise.resolve({ data: defaultStatus });
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithProviders(<RiegoPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan Matinal')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('¿Estás seguro de eliminar el plan "Plan Matinal"?')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Eliminar'));

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith('/riego/plans/p-1');
    });
  });

  it('edits existing plan', async () => {
    renderWithProviders(<RiegoPlansPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan Matinal')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTestId('EditIcon');
    await userEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Editar Plan')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Plan Matinal')).toBeInTheDocument();
    });
  });
});
