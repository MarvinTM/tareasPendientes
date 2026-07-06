import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CategoryDialog from '../../components/CategoryDialog';

const theme = createTheme();

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('CategoryDialog', () => {
  it('renders create mode when no category provided', () => {
    renderWithTheme(
      <CategoryDialog open={true} category={null} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(screen.getByText('Nueva Categoría')).toBeInTheDocument();
  });

  it('renders edit mode when category provided', () => {
    const cat = { id: 'c1', name: 'Work', emoji: '💼' };
    renderWithTheme(
      <CategoryDialog open={true} category={cat} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(screen.getByText('Editar Categoría')).toBeInTheDocument();
  });

  it('pre-fills name and emoji when editing', () => {
    const cat = { id: 'c1', name: 'Work', emoji: '💼' };
    renderWithTheme(
      <CategoryDialog open={true} category={cat} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(screen.getByDisplayValue('Work')).toBeInTheDocument();
    expect(screen.getByDisplayValue('💼')).toBeInTheDocument();
  });

  it('shows emoji preview when emoji is entered', async () => {
    renderWithTheme(
      <CategoryDialog open={true} category={null} onClose={vi.fn()} onSave={vi.fn()} />
    );
    const emojiInput = screen.getByLabelText(/Emoji/);
    await userEvent.type(emojiInput, '🎉');
    expect(screen.getByText('Vista previa:')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    renderWithTheme(
      <CategoryDialog open={true} category={null} onClose={onClose} onSave={vi.fn()} />
    );
    await userEvent.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave with name and emoji', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithTheme(
      <CategoryDialog open={true} category={null} onClose={vi.fn()} onSave={onSave} />
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Nombre/), 'New Cat');
    await user.type(screen.getByLabelText(/Emoji/), '📋');

    await user.click(screen.getByText('Crear'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Cat', emoji: '📋' }),
      undefined
    );
  });

  it('has Crear button disabled when fields are empty', () => {
    renderWithTheme(
      <CategoryDialog open={true} category={null} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(screen.getByText('Crear')).toBeDisabled();
  });

  it('shows Guardar button text in edit mode', () => {
    const cat = { id: 'c1', name: 'W', emoji: '💼' };
    renderWithTheme(
      <CategoryDialog open={true} category={cat} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(screen.getByText('Guardar')).toBeInTheDocument();
  });
});
