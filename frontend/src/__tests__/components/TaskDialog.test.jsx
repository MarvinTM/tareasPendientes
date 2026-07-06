import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import TaskDialog from '../../components/TaskDialog';

const theme = createTheme();

vi.mock('../../components/UserAvatar', () => ({
  default: ({ user }) => <span>{user?.name}</span>
}));

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('TaskDialog', () => {
  const categories = [
    { id: 'cat-1', name: 'Work', emoji: '💼' },
    { id: 'cat-2', name: 'Home', emoji: '🏠' }
  ];
  const users = [
    { id: 'usr-1', name: 'John Doe' },
    { id: 'usr-2', name: 'Jane Doe' }
  ];

  it('renders create mode title when no task provided', () => {
    renderWithTheme(
      <TaskDialog open={true} task={null} onClose={vi.fn()} onSave={vi.fn()} categories={categories} users={users} />
    );
    expect(screen.getByText('Nueva Tarea')).toBeInTheDocument();
  });

  it('renders edit mode title when task is provided', () => {
    const task = { id: 't1', title: 'Existing', size: 'Pequena', category: { id: 'cat-1' }, description: null };
    renderWithTheme(
      <TaskDialog open={true} task={task} onClose={vi.fn()} onSave={vi.fn()} categories={categories} users={users} />
    );
    expect(screen.getByText('Editar Tarea')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing')).toBeInTheDocument();
  });

  it('pre-fills fields when editing a task', () => {
    const task = { id: 't1', title: 'My Task', description: 'Desc', size: 'Mediana', category: { id: 'cat-2' }, assignedTo: { id: 'usr-1' } };
    renderWithTheme(
      <TaskDialog open={true} task={task} onClose={vi.fn()} onSave={vi.fn()} categories={categories} users={users} />
    );
    expect(screen.getByDisplayValue('My Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Desc')).toBeInTheDocument();
  });

  it('renders category select', () => {
    renderWithTheme(
      <TaskDialog open={true} task={null} onClose={vi.fn()} onSave={vi.fn()} categories={categories} users={users} />
    );
    const labels = screen.getAllByText(/Categoría/);
    expect(labels.length).toBeGreaterThan(0);
  });

  it('shows assignee selector only in create mode', () => {
    const task = { id: 't1', title: 'T', category: { id: 'cat-1' } };
    const { rerender } = renderWithTheme(
      <TaskDialog open={true} task={null} onClose={vi.fn()} onSave={vi.fn()} categories={categories} users={users} />
    );
    const labels = screen.getAllByText(/Asignar a/);
    expect(labels.length).toBeGreaterThan(0);

    rerender(
      <ThemeProvider theme={theme}>
        <TaskDialog open={true} task={task} onClose={vi.fn()} onSave={vi.fn()} categories={categories} users={users} />
      </ThemeProvider>
    );
    expect(screen.queryByText('Asignar a (opcional)')).not.toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    renderWithTheme(
      <TaskDialog open={true} task={null} onClose={onClose} onSave={vi.fn()} categories={categories} users={users} />
    );
    await userEvent.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave with correct data on submit', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const task = { id: 't-edit', title: 'Old Title', description: 'Old Desc', size: 'Pequena', category: { id: 'cat-1' } };
    renderWithTheme(
      <TaskDialog open={true} task={task} onClose={onClose} onSave={onSave} categories={categories} users={users} />
    );

    const user = userEvent.setup();
    const titleInput = screen.getByDisplayValue('Old Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Title');

    await user.click(screen.getByText('Guardar'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated Title' }),
      't-edit'
    );
  });

  it('has create button disabled when required fields are empty', () => {
    renderWithTheme(
      <TaskDialog open={true} task={null} onClose={vi.fn()} onSave={vi.fn()} categories={categories} users={users} />
    );
    const createButton = screen.getByText('Crear');
    expect(createButton).toBeDisabled();
  });

  it('shows Guardar as button text in edit mode', () => {
    const task = { id: 't1', title: 'T', size: 'Pequena', category: { id: 'cat-1' } };
    renderWithTheme(
      <TaskDialog open={true} task={task} onClose={vi.fn()} onSave={vi.fn()} categories={categories} users={users} />
    );
    expect(screen.getByText('Guardar')).toBeInTheDocument();
  });
});
