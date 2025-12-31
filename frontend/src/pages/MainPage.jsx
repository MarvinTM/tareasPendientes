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
import AddIcon from '@mui/icons-material/Add';
import TaskBoard from '../components/TaskBoard';
import TaskDialog from '../components/TaskDialog';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';

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
        <Typography variant="h4" component="h1">
          Tareas
        </Typography>
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
