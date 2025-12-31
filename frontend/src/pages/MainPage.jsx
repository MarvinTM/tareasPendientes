import { useState, useEffect, useCallback } from 'react';
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
import TaskBoard from '../components/TaskBoard';
import TaskDialog from '../components/TaskDialog';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';

const sizeLegend = [
  { label: 'S', description: '< 1 hora', color: '#4caf50' },
  { label: 'M', description: '1-2 horas', color: '#ff9800' },
  { label: 'L', description: '> 2 horas', color: '#f44336' }
];

export default function MainPage() {
  const [tasks, setTasks] = useState({ Nueva: [], EnProgreso: [], Completada: [] });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [reopenConfirm, setReopenConfirm] = useState(null);
  const [infoAnchor, setInfoAnchor] = useState(null);
  const socket = useSocket();

  const fetchTasks = useCallback(async () => {
    try {
      const response = await api.get('/tasks');
      setTasks(response.data);
      setError(null);
    } catch (err) {
      setError('Error al cargar las tareas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, [fetchTasks]);

  // Listen for real-time task updates
  useEffect(() => {
    if (!socket) return;

    const handleTaskUpdate = () => {
      fetchTasks();
    };

    socket.on('task:created', handleTaskUpdate);
    socket.on('task:updated', handleTaskUpdate);
    socket.on('task:deleted', handleTaskUpdate);

    return () => {
      socket.off('task:created', handleTaskUpdate);
      socket.off('task:updated', handleTaskUpdate);
      socket.off('task:deleted', handleTaskUpdate);
    };
  }, [socket, fetchTasks]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
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
    movedTask.status = destStatus;
    newTasks[destStatus].splice(destination.index, 0, movedTask);
    setTasks(newTasks);

    // Update on server
    try {
      await api.patch(`/tasks/${taskId}`, { status: destStatus });
    } catch (err) {
      // Revert on error
      fetchTasks();
      setError('Error al mover la tarea');
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
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="h4" component="h1">
            Tareas
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
        >
          Nueva Tarea
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TaskBoard
        tasks={tasks}
        users={users}
        onDragEnd={handleDragEnd}
        onEdit={handleOpenDialog}
        onDelete={setDeleteConfirm}
        onAssign={handleAssignTask}
        onSizeChange={handleSizeChange}
      />

      <TaskDialog
        open={dialogOpen}
        task={editingTask}
        onClose={handleCloseDialog}
        onSave={handleSaveTask}
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
