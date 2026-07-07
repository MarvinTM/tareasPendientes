import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import RiegoBanner from '../../components/RiegoBanner';

const theme = createTheme();

const mockApiPost = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    post: (...args) => mockApiPost(...args),
  },
}));

function renderWithProviders(ui) {
  return render(
    <ThemeProvider theme={theme}>{ui}</ThemeProvider>
  );
}

function makeCurrent(overrides = {}) {
  return {
    queueId: 'q1',
    phaseId: 'p1',
    name: 'Jardín',
    durationMin: 10,
    remaining: 300,
    status: 'running',
    ...overrides,
  };
}

describe('RiegoBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when current is null', () => {
    it('renders a collapsed container', () => {
      renderWithProviders(<RiegoBanner current={null} />);
      expect(screen.getByTestId('riego-banner')).toBeInTheDocument();
    });
  });

  describe('when riego is running', () => {
    it('shows the phase name', () => {
      renderWithProviders(<RiegoBanner current={makeCurrent({ name: 'Jardín' })} />);
      expect(screen.getByText('Jardín')).toBeInTheDocument();
    });

    it('shows the water drop icon', () => {
      renderWithProviders(<RiegoBanner current={makeCurrent()} />);
      expect(screen.getByTestId('riego-banner')).toBeInTheDocument();
    });

    it('shows the time remaining', () => {
      renderWithProviders(<RiegoBanner current={makeCurrent({ remaining: 185 })} />);
      expect(screen.getByText('3m 5s')).toBeInTheDocument();
    });

    it('shows seconds only when under one minute', () => {
      renderWithProviders(<RiegoBanner current={makeCurrent({ remaining: 45 })} />);
      expect(screen.getByText('45 seg')).toBeInTheDocument();
    });

    it('shows zero when no time remains', () => {
      renderWithProviders(<RiegoBanner current={makeCurrent({ remaining: 0 })} />);
      expect(screen.getByText('0 seg')).toBeInTheDocument();
    });

    it('renders the progress bar fill', () => {
      renderWithProviders(<RiegoBanner current={makeCurrent()} />);
      expect(screen.getByTestId('riego-banner-fill')).toBeInTheDocument();
    });

    it('shows the stop button', () => {
      renderWithProviders(<RiegoBanner current={makeCurrent()} />);
      expect(screen.getByTestId('riego-banner-stop')).toBeInTheDocument();
    });
  });

  describe('progress bar fill width', () => {
    it('is at 0% when just started', () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ durationMin: 10, remaining: 600 })} />
      );
      const fill = screen.getByTestId('riego-banner-fill');
      expect(fill).toHaveStyle({ width: '0%' });
    });

    it('is at 50% when halfway', () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ durationMin: 10, remaining: 300 })} />
      );
      const fill = screen.getByTestId('riego-banner-fill');
      expect(fill).toHaveStyle({ width: '50%' });
    });

    it('is at 100% when fully elapsed', () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ durationMin: 10, remaining: 0 })} />
      );
      const fill = screen.getByTestId('riego-banner-fill');
      expect(fill).toHaveStyle({ width: '100%' });
    });
  });

  describe('stop button', () => {
    it('calls api.post with /riego/stop when clicked', async () => {
      mockApiPost.mockResolvedValue({});
      renderWithProviders(<RiegoBanner current={makeCurrent()} />);

      await userEvent.click(screen.getByTestId('riego-banner-stop'));
      expect(mockApiPost).toHaveBeenCalledWith('/riego/stop');
    });
  });

  describe('when connecting', () => {
    it('shows the connecting text', () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ status: 'connecting', remaining: 600 })} />
      );
      expect(screen.getByText('Conectando...')).toBeInTheDocument();
    });

    it('does not show the progress bar', () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ status: 'connecting' })} />
      );
      expect(screen.queryByTestId('riego-banner-fill')).not.toBeInTheDocument();
    });

    it('shows the stop button', () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ status: 'connecting' })} />
      );
      expect(screen.getByTestId('riego-banner-stop')).toBeInTheDocument();
    });
  });

  describe('when disconnecting', () => {
    it('shows the phase name', () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ status: 'disconnecting', remaining: 0 })} />
      );
      expect(screen.getByText('Jardín')).toBeInTheDocument();
    });

    it('shows the progress bar at 100%', () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ status: 'disconnecting', remaining: 0 })} />
      );
      const fill = screen.getByTestId('riego-banner-fill');
      expect(fill).toHaveStyle({ width: '100%' });
    });

    it('does not show the stop button', () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ status: 'disconnecting' })} />
      );
      expect(screen.queryByTestId('riego-banner-stop')).not.toBeInTheDocument();
    });

    it('does not show time remaining', () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ status: 'disconnecting', remaining: 0 })} />
      );
      expect(screen.queryByText(/seg/)).not.toBeInTheDocument();
    });
  });

  describe('countdown', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('decrements remaining each second when running', async () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ durationMin: 10, remaining: 600 })} />
      );

      expect(screen.getByText('10m 0s')).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(1000);
      expect(screen.getByText('9m 59s')).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(1000);
      expect(screen.getByText('9m 58s')).toBeInTheDocument();
    });

    it('does not countdown when not running', async () => {
      renderWithProviders(
        <RiegoBanner current={makeCurrent({ status: 'connecting', remaining: 600 })} />
      );

      expect(screen.queryByText(/m\s/)).not.toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(10000);
      expect(screen.queryByText(/m\s/)).not.toBeInTheDocument();
    });
  });
});
