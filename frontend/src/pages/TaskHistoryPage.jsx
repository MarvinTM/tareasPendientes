import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../services/api';
import UserAvatar from '../components/UserAvatar';

const actionLabels = {
  CREATED: { label: 'Creada', color: 'success' },
  STATUS_CHANGED: { label: 'Estado Cambiado', color: 'info' },
  SIZE_CHANGED: { label: 'Dificultad Cambiada', color: 'secondary' },
  TITLE_UPDATED: { label: 'Título Actualizado', color: 'warning' },
  DESCRIPTION_UPDATED: { label: 'Descripción Actualizada', color: 'warning' },
  ASSIGNED: { label: 'Asignada', color: 'primary' },
  UNASSIGNED: { label: 'Desasignada', color: 'default' },
  DELETED: { label: 'Eliminada', color: 'error' }
};

export default function TaskHistoryPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, [taskId]);

  const fetchHistory = async () => {
    try {
      const response = await api.get(`/tasks/${taskId}/history`);
      setHistory(response.data.history);
      setTaskTitle(response.data.task?.title || '');
      setError(null);
    } catch (err) {
      setError('Error al cargar el historial de la tarea');
      console.error(err);
    } finally {
      setLoading(false);
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
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/')}
        sx={{ mb: 2 }}
      >
        Volver a Tareas
      </Button>

      <Typography variant="h4" component="h1" gutterBottom>
        Historial de la Tarea: {taskTitle}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {history.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No se encontró historial para esta tarea.</Typography>
        </Paper>
      ) : (
        <Paper>
          <List>
            {history.map((entry, index) => {
              const actionConfig = actionLabels[entry.action] || { label: entry.action, color: 'default' };

              return (
                <Box key={entry.id}>
                  {index > 0 && <Divider />}
                  <ListItem alignItems="flex-start">
                    <ListItemAvatar>
                      <UserAvatar user={entry.user} sx={{ width: 40, height: 40 }} showTooltip={false} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography component="span" fontWeight="medium">
                            {entry.user?.name || 'Usuario Desconocido'}
                          </Typography>
                          <Chip
                            label={actionConfig.label}
                            color={actionConfig.color}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box component="span">
                          <Typography variant="body2" color="text.secondary" component="span">
                            {new Date(entry.timestamp).toLocaleString()}
                          </Typography>
                          {(entry.previousValue || entry.newValue) && (
                            <Box sx={{ mt: 1 }}>
                              {entry.previousValue && (
                                <Typography variant="body2" component="div">
                                  <strong>De:</strong> {entry.previousValue}
                                </Typography>
                              )}
                              {entry.newValue && (
                                <Typography variant="body2" component="div">
                                  <strong>A:</strong> {entry.newValue}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                </Box>
              );
            })}
          </List>
        </Paper>
      )}
    </Box>
  );
}
