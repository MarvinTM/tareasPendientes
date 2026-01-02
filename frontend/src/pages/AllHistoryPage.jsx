import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import HistoryIcon from '@mui/icons-material/History';
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

export default function AllHistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/history?page=${page}&limit=30`);
      setHistory(response.data.history);
      setPagination(response.data.pagination);
      setError(null);
    } catch (err) {
      setError('Error al cargar el historial');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && page === 1) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon fontSize="large" color="primary" /> Historial de Actividad
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {history.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No hay actividad registrada.</Typography>
        </Paper>
      ) : (
        <>
          <Paper>
            <List>
              {history.map((entry, index) => {
                const actionConfig = actionLabels[entry.action] || { label: entry.action, color: 'default' };

                return (
                  <Box key={entry.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        cursor: entry.task ? 'pointer' : 'default',
                        '&:hover': entry.task ? { backgroundColor: 'action.hover' } : {}
                      }}
                      onClick={() => entry.task && navigate(`/history/${entry.taskId}`)}
                    >
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
                            {entry.task && (
                              <Chip
                                label={entry.task.title}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box component="span" sx={{ display: 'block' }}>
                            <Typography variant="body2" color="text.secondary" component="span">
                              {new Date(entry.timestamp).toLocaleString()}
                            </Typography>
                            {(entry.previousValue || entry.newValue) && (
                              <Box component="span" sx={{ display: 'block', mt: 1 }}>
                                {entry.previousValue && (
                                  <Typography variant="body2" component="span" sx={{ display: 'block' }}>
                                    <strong>De:</strong> {entry.previousValue}
                                  </Typography>
                                )}
                                {entry.newValue && (
                                  <Typography variant="body2" component="span" sx={{ display: 'block' }}>
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

          {pagination && pagination.totalPages > 1 && (
            <Box display="flex" justifyContent="center" gap={2} mt={3}>
              <Button
                variant="outlined"
                disabled={page === 1 || loading}
                onClick={() => setPage(p => p - 1)}
              >
                Anterior
              </Button>
              <Typography sx={{ display: 'flex', alignItems: 'center' }}>
                Página {page} de {pagination.totalPages}
              </Typography>
              <Button
                variant="outlined"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage(p => p + 1)}
              >
                Siguiente
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
