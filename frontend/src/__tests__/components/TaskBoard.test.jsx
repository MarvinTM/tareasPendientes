import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import TaskBoard from '../../components/TaskBoard';

const theme = createTheme();

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }) => <div data-testid="dnd-context" onClick={() => onDragEnd?.({ source: {}, destination: { droppableId: 'Nueva' }, draggableId: '1' }, vi.fn())}>{children}</div>,
  Draggable: ({ children }) => children({
    innerRef: vi.fn(),
    draggableProps: {},
    dragHandleProps: {}
  }, { isDragging: false }),
  Droppable: ({ children }) => children({
    innerRef: vi.fn(),
    droppableProps: {},
    placeholder: null
  }, { isDraggingOver: false })
}));

vi.mock('../../components/TaskColumn', () => ({
  default: ({ status, tasks, title, onEdit, onDelete, compactMode }) => (
    <div data-testid={`column-${status}`}>
      {title && <span>{title}</span>}
      <span data-testid={`count-${status}`}>{tasks.length}</span>
      {tasks.map(t => <div key={t.id}>{t.title}</div>)}
    </div>
  )
}));

vi.mock('../../components/UserAvatar', () => ({
  default: () => <span />
}));

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('TaskBoard', () => {
  const defaultTasks = {
    Pendientes_0: [{ id: '1', title: 'Task 1', status: 'Nueva' }, { id: '2', title: 'Task 2', status: 'Nueva' }],
    Pendientes_1: [],
    Completada: [{ id: '3', title: 'Task 3', status: 'Completada' }]
  };

  const defaultProps = {
    tasks: defaultTasks,
    users: [{ id: 'u1', name: 'User' }],
    categories: [{ id: 'c1', name: 'Cat', emoji: '📋' }],
    weeklyScores: [],
    onDragEnd: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onAssign: vi.fn(),
    onSizeChange: vi.fn(),
    newFilter: 'all',
    onNewFilterChange: vi.fn(),
    categoryFilter: 'all',
    onCategoryFilterChange: vi.fn(),
    completedFilter: 'week',
    onCompletedFilterChange: vi.fn(),
    numColumns: 1
  };

  it('renders Pendientes header', () => {
    renderWithTheme(<TaskBoard {...defaultProps} />);
    expect(screen.getByText('Pendientes')).toBeInTheDocument();
  });

  it('shows correct pending task count', () => {
    renderWithTheme(<TaskBoard {...defaultProps} />);
    expect(screen.getByText('2 tareas')).toBeInTheDocument();
  });

  it('renders filter toggle buttons', () => {
    renderWithTheme(<TaskBoard {...defaultProps} />);
    expect(screen.getByText('Todas')).toBeInTheDocument();
    expect(screen.getByText('Mías')).toBeInTheDocument();
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
  });

  it('calls onNewFilterChange when filter is clicked', async () => {
    const onNewFilterChange = vi.fn();
    renderWithTheme(<TaskBoard {...defaultProps} onNewFilterChange={onNewFilterChange} />);
    await userEvent.click(screen.getByText('Mías'));
    expect(onNewFilterChange).toHaveBeenCalled();
  });

  it('renders columns', () => {
    renderWithTheme(<TaskBoard {...defaultProps} />);
    expect(screen.getByTestId('column-Pendientes_0')).toBeInTheDocument();
    expect(screen.getByTestId('column-Completada')).toBeInTheDocument();
  });

  it('shows "Sin puntos" when no weekly scores', () => {
    renderWithTheme(<TaskBoard {...defaultProps} numColumns={2} />);
    expect(screen.getByText('Sin puntos')).toBeInTheDocument();
  });

  it('shows Esta Semana scoreboard header', () => {
    renderWithTheme(<TaskBoard {...defaultProps} numColumns={2} />);
    expect(screen.getByText('Esta Semana')).toBeInTheDocument();
  });

  it('shows 1 tarea when only one pending task', () => {
    const singleTask = {
      Pendientes_0: [{ id: '1', title: 'Task 1', status: 'Nueva' }],
      Pendientes_1: [],
      Completada: []
    };
    renderWithTheme(<TaskBoard {...defaultProps} tasks={singleTask} />);
    expect(screen.getByText('1 tarea')).toBeInTheDocument();
  });

  it('renders completed filter in completed column', () => {
    renderWithTheme(<TaskBoard {...defaultProps} />);
    expect(screen.getByTestId('column-Completada')).toBeInTheDocument();
  });

  it('renders Category section in Completadas sidebar', () => {
    renderWithTheme(<TaskBoard {...defaultProps} />);
    expect(screen.getByText('Completadas')).toBeInTheDocument();
  });
});
