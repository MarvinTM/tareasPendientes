import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PulseDeviceButton from '../../components/PulseDeviceButton';

const theme = createTheme();
const mockApiPost = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    post: (...args) => mockApiPost(...args),
  },
}));

vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => null,
}));

function renderButton(device = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <PulseDeviceButton
        device={{ id: 'puerta-garaje', name: 'Puerta Garaje', group: 'garaje', online: true, ...device }}
        square
      />
    </ThemeProvider>,
  );
}

describe('PulseDeviceButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiPost.mockResolvedValue({ data: { id: 'puerta-garaje', triggered: true } });
  });

  it('sends a pulse and does not present a persistent on/off label', async () => {
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: /Puerta Garaje: accionar/i }));

    expect(mockApiPost).toHaveBeenCalledWith('/devices/puerta-garaje/pulse');
    await waitFor(() => expect(screen.getByText('Pulso enviado')).toBeInTheDocument());
    expect(screen.queryByText('Encendido')).not.toBeInTheDocument();
    expect(screen.queryByText('Apagado')).not.toBeInTheDocument();
  });

  it('disables the action when the device is offline', () => {
    renderButton({ online: false });

    expect(screen.getByRole('button', { name: /Puerta Garaje: accionar/i })).toBeDisabled();
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
  });
});
