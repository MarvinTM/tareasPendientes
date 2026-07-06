import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import TaskColumn from '../../components/TaskColumn';

const theme = createTheme();

vi.mock('@hello-pangea/dnd', () => ({
  Droppable: ({ children }) => children({
    innerRef: vi.fn(),
    droppableProps: {},
    placeholder: null
  }, { isDraggingOver: false })
}));

vi.mock('../../components/TaskCard', () => ({
  default: ({ task }) => <div data-testid={`task-card-${task.id}`}>{task.title}</div>
}));

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('TaskColumn', () => {
  const defaultProps = {
    status: 'Nueva',
    tasks: [],
    users: [],
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onAssign: vi.fn(),
    onSizeChange: vi.fn()
  };

  it('renders column title', () => {
    renderWithTheme(<TaskColumn {...defaultProps} />);
    expect(screen.getByText('Nueva')).toBeInTheDocument();
  });

  it('renders task count', () => {
    renderWithTheme(<TaskColumn {...defaultProps} tasks={[{ id: '1' }, { id: '2' }]} />);
    expect(screen.getByText('2 tareas')).toBeInTheDocument();
  });

  it('renders singular for 1 task', () => {
    renderWithTheme(<TaskColumn {...defaultProps} tasks={[{ id: '1' }]} />);
    expect(screen.getByText('1 tarea')).toBeInTheDocument();
  });

  it('renders custom title when provided', () => {
    renderWithTheme(<TaskColumn {...defaultProps} status="Completada" title="Completadas" />);
    expect(screen.getByText('Completadas')).toBeInTheDocument();
  });

  it('renders zero tasks count', () => {
    renderWithTheme(<TaskColumn {...defaultProps} />);
    expect(screen.getByText('0 tareas')).toBeInTheDocument();
  });

  it('renders task cards for each task', () => {
    const tasks = [
      { id: 't1', title: 'Task 1' },
      { id: 't2', title: 'Task 2' }
    ];
    renderWithTheme(<TaskColumn {...defaultProps} tasks={tasks} />);
    expect(screen.getByTestId('task-card-t1')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-t2')).toBeInTheDocument();
  });

  it('hides header when hideHeader is true', () => {
    renderWithTheme(<TaskColumn {...defaultProps} hideHeader={true} />);
    expect(screen.queryByText('Nueva')).not.toBeInTheDocument();
  });
});
