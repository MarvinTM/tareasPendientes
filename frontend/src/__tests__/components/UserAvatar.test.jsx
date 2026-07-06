import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import UserAvatar from '../../components/UserAvatar';

const theme = createTheme();

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('UserAvatar', () => {
  it('renders null when user is not provided', () => {
    const { container } = renderWithTheme(<UserAvatar user={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders initials from shortName', () => {
    renderWithTheme(<UserAvatar user={{ name: 'John Doe', shortName: 'JD', color: '#1976d2' }} sx={{ width: 40, height: 40 }} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders first letter of name when no shortName', () => {
    renderWithTheme(<UserAvatar user={{ name: 'John Doe', shortName: null }} sx={{ width: 40, height: 40 }} />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('renders ? when no name and no shortName', () => {
    renderWithTheme(<UserAvatar user={{ name: null, shortName: null }} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('renders picture as avatar src when no shortName and picture is provided', () => {
    renderWithTheme(<UserAvatar user={{ name: 'John', shortName: null, picture: 'https://example.com/pic.jpg' }} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/pic.jpg');
  });

  it('does not render picture when shortName is set', () => {
    renderWithTheme(<UserAvatar user={{ name: 'John', shortName: 'J', picture: 'https://example.com/pic.jpg' }} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('applies backgroundColor from user color', () => {
    renderWithTheme(<UserAvatar user={{ name: 'Test', color: '#1976d2' }} />);
    const avatar = document.querySelector('.MuiAvatar-root');
    const bgStyle = window.getComputedStyle(avatar).backgroundColor;
    expect(bgStyle).toBeTruthy();
  });

  it('shows tooltip by default with user name', async () => {
    renderWithTheme(<UserAvatar user={{ name: 'Jane', shortName: 'J' }} />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });
});
