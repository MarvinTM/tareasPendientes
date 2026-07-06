import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AppLogo from '../../components/AppLogo';

const theme = createTheme();

describe('AppLogo', () => {
  it('renders an SVG icon', () => {
    const { container } = render(
      <ThemeProvider theme={theme}><AppLogo /></ThemeProvider>
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with custom props', () => {
    render(
      <ThemeProvider theme={theme}><AppLogo data-testid="logo" fontSize="large" /></ThemeProvider>
    );
    expect(screen.getByTestId('logo')).toBeInTheDocument();
  });

  it('renders checkmark path for the logo design', () => {
    const { container } = render(
      <ThemeProvider theme={theme}><AppLogo /></ThemeProvider>
    );
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
  });
});
