import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import TaskCard from '../../components/TaskCard';

const theme = createTheme();

vi.mock('@hello-pangea/dnd', () => ({
  Draggable: ({ children }) => children({
    innerRef: vi.fn(),
    draggableProps: { 'data-rfd-draggable-props': 'mock' },
    dragHandleProps: { 'data-rfd-drag-handle': 'mock' }
  }, { isDragging: false })
}));

vi.mock('../../components/UserAvatar', () => ({
  default: ({ user }) => <span data-testid="avatar">{user?.name || user?.shortName || '?'}</span>
}));

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}

const baseTask = {
  id: 'task-1',
  title: 'Test Task',
  description: 'A description',
  status: 'Nueva',
  size: 'Pequena',
  createdAt: '2025-01-15T10:00:00Z',
  category: { id: 'cat-1', name: 'Work', emoji: '💼' },
  assignedTo: null,
  createdBy: { id: 'usr-1', name: 'Creator', shortName: 'CR' }
};

describe('TaskCard', () => {
  it('renders task title in expanded mode', () => {
    renderWithProviders(
      <TaskCard task={baseTask} index={0} users={[]} onEdit={vi.fn()} onDelete={vi.fn()} onAssign={vi.fn()} onSizeChange={vi.fn()} />
    );
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('renders category emoji', () => {
    renderWithProviders(
      <TaskCard task={baseTask} index={0} users={[]} onEdit={vi.fn()} onDelete={vi.fn()} onAssign={vi.fn()} onSizeChange={vi.fn()} />
    );
    expect(screen.getByText('💼')).toBeInTheDocument();
  });

  it('renders size toggle buttons', () => {
    renderWithProviders(
      <TaskCard task={baseTask} index={0} users={[]} onEdit={vi.fn()} onDelete={vi.fn()} onAssign={vi.fn()} onSizeChange={vi.fn()} />
    );
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  it('renders description in expanded mode', () => {
    renderWithProviders(
      <TaskCard task={baseTask} index={0} users={[]} onEdit={vi.fn()} onDelete={vi.fn()} onAssign={vi.fn()} onSizeChange={vi.fn()} />
    );
    expect(screen.getByText('A description')).toBeInTheDocument();
  });

  it('renders "Sin descripción" when no description', () => {
    const task = { ...baseTask, description: null };
    renderWithProviders(
      <TaskCard task={task} index={0} users={[]} onEdit={vi.fn()} onDelete={vi.fn()} onAssign={vi.fn()} onSizeChange={vi.fn()} />
    );
    expect(screen.getByText('Sin descripción')).toBeInTheDocument();
  });

  it('renders default category emoji when no category', () => {
    const task = { ...baseTask, category: null };
    renderWithProviders(
      <TaskCard task={task} index={0} users={[]} onEdit={vi.fn()} onDelete={vi.fn()} onAssign={vi.fn()} onSizeChange={vi.fn()} />
    );
    expect(screen.getByText('📋')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn();
    renderWithProviders(
      <TaskCard task={baseTask} index={0} users={[]} onEdit={onEdit} onDelete={vi.fn()} onAssign={vi.fn()} onSizeChange={vi.fn()} />
    );
    await userEvent.click(screen.getByLabelText('Editar'));
    expect(onEdit).toHaveBeenCalledWith(baseTask);
  });

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = vi.fn();
    renderWithProviders(
      <TaskCard task={baseTask} index={0} users={[]} onEdit={vi.fn()} onDelete={onDelete} onAssign={vi.fn()} onSizeChange={vi.fn()} />
    );
    await userEvent.click(screen.getByLabelText('Eliminar'));
    expect(onDelete).toHaveBeenCalledWith(baseTask);
  });

  it('hides edit button when task is completed', () => {
    const completedTask = { ...baseTask, status: 'Completada' };
    renderWithProviders(
      <TaskCard task={completedTask} index={0} users={[]} onEdit={vi.fn()} onDelete={vi.fn()} onAssign={vi.fn()} onSizeChange={vi.fn()} />
    );
    expect(screen.queryByLabelText('Editar')).not.toBeInTheDocument();
  });

  it('calls onToggleExpanded on click in compact mode', async () => {
    const onToggleExpanded = vi.fn();
    renderWithProviders(
      <TaskCard
        task={baseTask} index={0} users={[]}
        onEdit={vi.fn()} onDelete={vi.fn()} onAssign={vi.fn()} onSizeChange={vi.fn()}
        compactMode={true} onToggleExpanded={onToggleExpanded}
      />
    );
    await userEvent.click(screen.getByText('Test Task'));
    expect(onToggleExpanded).toHaveBeenCalledWith('task-1');
  });

  it('renders assignee name when assigned', () => {
    const task = { ...baseTask, assignedTo: { id: 'usr-2', name: 'Assignee', shortName: 'AS' } };
    renderWithProviders(
      <TaskCard task={task} index={0} users={[]} onEdit={vi.fn()} onDelete={vi.fn()} onAssign={vi.fn()} onSizeChange={vi.fn()} />
    );
    expect(screen.getAllByTestId('avatar').length).toBeGreaterThan(0);
  });

  it('renders history button linking to task history', () => {
    renderWithProviders(
      <TaskCard task={baseTask} index={0} users={[]} onEdit={vi.fn()} onDelete={vi.fn()} onAssign={vi.fn()} onSizeChange={vi.fn()} />
    );
    expect(screen.getByLabelText('Ver Historial')).toBeInTheDocument();
  });
});
