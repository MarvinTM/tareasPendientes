import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TaskBoard from '../components/TaskBoard';
import TaskDialog from '../components/TaskDialog';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const sizeLegend = [
  { label: 'S', description: '< 1 hora', color: '#4caf50' },
  { label: 'M', description: '1-2 horas', color: '#ff9800' },
  { label: 'L', description: '> 2 horas', color: '#f44336' }
];

const getMonthName = () => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[new Date().getMonth()];
};

const getStartOfWeek = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
};

const getStartOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const getStartOfYear = () => {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
};

export default function MainPage() {
  const [tasks, setTasks] = useState({ Nueva: [], EnProgreso: [], Completada: [] });
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [weeklyScores, setWeeklyScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [reopenConfirm, setReopenConfirm] = useState(null);
  const [infoAnchor, setInfoAnchor] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'mine', 'unassigned'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' or categoryId
  const [completedFilter, setCompletedFilter] = useState('week'); // 'week', 'month', 'year'
  const socket = useSocket();
  const { user } = useAuth();
  
  const theme = useTheme();
  
  // Custom aggressive breakpoints to maximize space usage (Sidebar is ~320px)
  const is920 = useMediaQuery('(min-width:920px)');
  const is1220 = useMediaQuery('(min-width:1220px)');
  const is1520 = useMediaQuery('(min-width:1520px)');
  const is1820 = useMediaQuery('(min-width:1820px)');
  const is2120 = useMediaQuery('(min-width:2120px)');
  
  const numColumns = (() => {
    if (is2120) return 5; 
    if (is1820) return 4;
    if (is1520) return 3;
    if (is1220) return 3; // 3 columns fit well at 1220px (900px available)
    if (is920) return 2;  // 2 columns fit well at 920px (600px available)
    return 1;             // Mobile or very small screens
  })();

  // Apply filters to columns
  const getFilteredTasks = () => {
    const filtered = { ...tasks };

    // Helper to filter pending lists
    const filterList = (list) => {
      let result = list;
      if (filter === 'mine') {
        result = result.filter(task => task.assignedTo?.id === user?.id);
      } else if (filter === 'unassigned') {
        result = result.filter(task => !task.assignedTo);
      }

      if (categoryFilter !== 'all') {
        result = result.filter(task => task.categoryId === categoryFilter);
      }
      return result;
    };

    // Dynamic filtering for all pending columns
    for (let i = 0; i < numColumns; i++) {
      const key = `Pendientes_${i}`;
      if (tasks[key]) {
        filtered[key] = filterList(tasks[key]);
      }
    }

    // Filter "Completada" column by completion date
    let startDate;
    if (completedFilter === 'week') {
      startDate = getStartOfWeek();
    } else if (completedFilter === 'month') {
      startDate = getStartOfMonth();
    } else if (completedFilter === 'year') {
      startDate = getStartOfYear();
    }

    if (startDate) {
      filtered.Completada = tasks.Completada.filter(task => {
        if (!task.completedAt) return false;
        return new Date(task.completedAt) >= startDate;
      });
    }

    return filtered;
  };

  const fetchTasks = useCallback(async () => {
    try {
      const response = await api.get('/tasks');
      const data = response.data;
      
      // Merge 'EnProgreso' tasks into 'Nueva' and split into dynamic columns
      const allPending = [...(data.Nueva || []), ...(data.EnProgreso || [])];
      
      const cols = Array.from({ length: numColumns }, () => []);
      
      allPending.forEach((task, index) => {
        cols[index % numColumns].push(task);
      });

      const newTasks = {
        Completada: data.Completada || []
      };
      
      cols.forEach((col, idx) => {
        newTasks[`Pendientes_${idx}`] = col;
      });

      setTasks(newTasks);
      setError(null);
    } catch (err) {
      setError('Error al cargar las tareas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [numColumns]);

  const fetchWeeklyScores = useCallback(async () => {
    try {
      const response = await api.get('/users/scores?period=week');
      setWeeklyScores(response.data.filter(s => s.totalPoints > 0));
    } catch (err) {
      console.error('Error fetching weekly scores:', err);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    fetchCategories();
    fetchWeeklyScores();
  }, [fetchTasks, fetchWeeklyScores]);

  // Listen for real-time task updates
  useEffect(() => {
    if (!socket) return;

    const handleTaskUpdate = () => {
      fetchTasks();
      fetchWeeklyScores();
    };

    socket.on('task:created', handleTaskUpdate);
    socket.on('task:updated', handleTaskUpdate);
    socket.on('task:deleted', handleTaskUpdate);

    return () => {
      socket.off('task:created', handleTaskUpdate);
      socket.off('task:updated', handleTaskUpdate);
      socket.off('task:deleted', handleTaskUpdate);
    };
  }, [socket, fetchTasks, fetchWeeklyScores]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;

    // If moving OUT of Completada, show confirmation
    if (sourceStatus === 'Completada' && destStatus !== 'Completada') {
      setReopenConfirm({
        taskId: draggableId,
        source,
        destination,
        sourceStatus,
        destStatus
      });
      return;
    }

    await executeMove(draggableId, source, destination, sourceStatus, destStatus);
  };

  const executeMove = async (taskId, source, destination, sourceStatus, destStatus) => {
    // Optimistic update
    const newTasks = { ...tasks };
    const [movedTask] = newTasks[sourceStatus].splice(source.index, 1);
    
    // Determine the actual API status based on column
    const isPending = destStatus.startsWith('Pendientes');
    const apiStatus = isPending ? 'Nueva' : 'Completada';
    
    // Update local object status for consistency
    movedTask.status = apiStatus;

    // Auto-assign if moving from a pending col to another pending col (or unassigned logic)
    // Actually, simple logic: if moving TO pending from anywhere and unassigned, auto-assign.
    const wasPending = sourceStatus.startsWith('Pendientes');
    const shouldAutoAssign = !wasPending && isPending && !movedTask.assignedTo;
    
    if (shouldAutoAssign) {
      movedTask.assignedTo = user;
    }

    newTasks[destStatus].splice(destination.index, 0, movedTask);
    setTasks(newTasks);

    // Update on server
    // If moving between pending columns, we don't need to call API unless auto-assign happened
    // because backend doesn't track column 0 vs 1.
    if (sourceStatus !== destStatus || shouldAutoAssign) {
      try {
        const updateData = { status: apiStatus };
        if (shouldAutoAssign) {
          updateData.assignedToId = user.id;
        }
        
        // Only call API if status changed or assigned changed
        // Moving between Pendientes_0 and Pendientes_1 without assign change = no API call needed?
        // Wait, if we don't call API, a refresh will reset positions. That's expected for this layout.
        if (!wasPending || !isPending || shouldAutoAssign) {
             await api.patch(`/tasks/${taskId}`, updateData);
        }
      } catch (err) {
        // Revert on error
        fetchTasks();
        setError('Error al mover la tarea');
      }
    }
  };

  const handleConfirmReopen = async () => {
    if (!reopenConfirm) return;

    const { taskId, source, destination, sourceStatus, destStatus } = reopenConfirm;
    setReopenConfirm(null);
    await executeMove(taskId, source, destination, sourceStatus, destStatus);
  };

  const handleOpenDialog = (task = null) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTask(null);
  };

  const handleSaveTask = async (data, taskId) => {
    try {
      if (taskId) {
        await api.patch(`/tasks/${taskId}`, data);
      } else {
        await api.post('/tasks', data);
      }
      fetchTasks();
    } catch (err) {
      setError('Error al guardar la tarea');
      throw err;
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      await api.delete(`/tasks/${deleteConfirm.id}`);
      fetchTasks();
    } catch (err) {
      setError('Error al eliminar la tarea');
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleAssignTask = async (taskId, userId) => {
    try {
      await api.patch(`/tasks/${taskId}`, { assignedToId: userId });
      fetchTasks();
    } catch (err) {
      setError('Error al asignar la tarea');
    }
  };

  const handleSizeChange = async (taskId, size) => {
    try {
      await api.patch(`/tasks/${taskId}`, { size });
      fetchTasks();
    } catch (err) {
      setError('Error al cambiar el tamaño de la tarea');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={{ xs: 1, sm: 2 }} sx={{ flexShrink: 0 }}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
            <AssignmentIcon sx={{ fontSize: { xs: 'large', sm: 'inherit' } }} color="primary" /> Tareas
          </Typography>
          <Tooltip title="Ver leyenda de dificultad">
            <IconButton
              size="small"
              onClick={(e) => setInfoAnchor(e.currentTarget)}
              sx={{ color: 'text.secondary' }}
            >
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Popover
            open={Boolean(infoAnchor)}
            anchorEl={infoAnchor}
            onClose={() => setInfoAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Dificultad de tareas
              </Typography>
              {sizeLegend.map((size) => (
                <Box key={size.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label={size.label}
                    size="small"
                    sx={{
                      backgroundColor: size.color,
                      color: 'white',
                      fontWeight: 'bold',
                      minWidth: 28,
                      height: 22,
                      fontSize: '0.7rem'
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {size.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Popover>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ whiteSpace: 'nowrap', px: { xs: 1.5, sm: 2 }, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
        >
          Nueva Tarea
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1, flexShrink: 0 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TaskBoard
        tasks={getFilteredTasks()}
        users={users}
        categories={categories}
        weeklyScores={weeklyScores}
        onDragEnd={handleDragEnd}
        onEdit={handleOpenDialog}
        onDelete={setDeleteConfirm}
        onAssign={handleAssignTask}
        onSizeChange={handleSizeChange}
        newFilter={filter}
        onNewFilterChange={setFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        completedFilter={completedFilter}
        onCompletedFilterChange={setCompletedFilter}
        numColumns={numColumns}
      />

      <TaskDialog
        open={dialogOpen}
        task={editingTask}
        onClose={handleCloseDialog}
        onSave={handleSaveTask}
        users={users}
        categories={categories}
      />

      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Eliminar Tarea</DialogTitle>
        <DialogContent>
          ¿Estás seguro de que quieres eliminar "{deleteConfirm?.title}"?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancelar</Button>
          <Button onClick={handleDeleteTask} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(reopenConfirm)} onClose={() => setReopenConfirm(null)}>
        <DialogTitle>Reabrir Tarea</DialogTitle>
        <DialogContent>
          ¿Estás seguro de que quieres volver a abrir la tarea?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReopenConfirm(null)}>No</Button>
          <Button onClick={handleConfirmReopen} variant="contained" color="primary">
            Sí
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
