import { useState, useEffect } from 'react';
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

export default function MainPage() {
  const [tasks, setTasks] = useState({ NEW: [], ONGOING: [], BACKLOG: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
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

    // Optimistic update
    const newTasks = { ...tasks };
    const [movedTask] = newTasks[sourceStatus].splice(source.index, 1);
    movedTask.status = destStatus;
    newTasks[destStatus].splice(destination.index, 0, movedTask);
    setTasks(newTasks);

    // Update on server
    try {
      await api.patch(`/tasks/${draggableId}`, { status: destStatus });
    } catch (err) {
      // Revert on error
      fetchTasks();
      setError('Error al mover la tarea');
    }
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
        onDragEnd={handleDragEnd}
        onEdit={handleOpenDialog}
        onDelete={setDeleteConfirm}
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
    </Box>
  );
}
