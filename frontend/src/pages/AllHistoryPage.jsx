import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
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
  DELETED: { label: 'Eliminada', color: 'error' },
  CATEGORY_CHANGED: { label: 'Categoría Cambiada', color: 'secondary' },
  DEVICE_TURNED_ON: { label: 'Dispositivo Encendido', color: 'success' },
  DEVICE_TURNED_OFF: { label: 'Dispositivo Apagado', color: 'default' },
  RIEGO_PHASE_STARTED: { label: 'Fase de Riego Iniciada', color: 'info' },
  RIEGO_PHASE_STOPPED: { label: 'Fase de Riego Detenida', color: 'warning' },
  RIEGO_PLAN_CREATED: { label: 'Plan de Riego Creado', color: 'success' },
  RIEGO_PLAN_UPDATED: { label: 'Plan de Riego Actualizado', color: 'warning' },
  RIEGO_PLAN_DELETED: { label: 'Plan de Riego Eliminado', color: 'error' },
  RIEGO_PLAN_TRIGGERED: { label: 'Plan de Riego Ejecutado', color: 'info' },
};

export default function AllHistoryPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef(null);

  const fetchEntries = useCallback(async (before) => {
    try {
      if (before) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const params = { limit: 30 };
      if (before) params.before = before;
      const response = await api.get('/activity', { params });
      if (before) {
        setEntries(prev => [...prev, ...response.data.entries]);
      } else {
        setEntries(response.data.entries);
      }
      setNextCursor(response.data.nextCursor);
      setHasMore(response.data.hasMore);
      setError(null);
    } catch (err) {
      setError('Error al cargar el historial');
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(null);
  }, [fetchEntries]);

  useEffect(() => {
    if (!nextCursor) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchEntries(nextCursor);
      }
    }, { threshold: 0.1 });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, hasMore, loadingMore, fetchEntries]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, pb: { xs: 7, md: 0 } }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon fontSize="large" color="primary" /> Historial de Actividad
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {entries.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No hay actividad registrada.</Typography>
        </Paper>
      ) : (
        <Paper>
          <List>
            {entries.map((entry, index) => {
              const actionConfig = actionLabels[entry.action] || { label: entry.action, color: 'default' };

              return (
                <Box key={entry.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    alignItems="flex-start"
                    sx={{
                      cursor: entry.type === 'task' && entry.task ? 'pointer' : 'default',
                      '&:hover': entry.type === 'task' && entry.task ? { backgroundColor: 'action.hover' } : {},
                    }}
                    onClick={() => {
                      if (entry.type === 'task' && entry.task) {
                        navigate(`/usuario/historial/${entry.taskId}`);
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <UserAvatar user={entry.user} sx={{ width: 40, height: 40 }} showTooltip={false} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography component="span" fontWeight="medium">
                            {entry.user?.name || (entry.details?.scheduled ? 'Sistema' : 'Usuario Desconocido')}
                          </Typography>
                          <Chip
                            label={actionConfig.label}
                            color={actionConfig.color}
                            size="small"
                          />
                          {entry.type === 'task' && entry.task && (
                            <Chip
                              label={entry.task.title}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {entry.type === 'activity' && entry.targetName && (
                            <Chip
                              label={entry.targetName}
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
                          {entry.type === 'task' && (entry.previousValue || entry.newValue) && (
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
                          {entry.type === 'activity' && entry.details && (
                            <Box component="span" sx={{ display: 'block', mt: 1 }}>
                              {entry.details.phasesCount !== undefined && (
                                <Typography variant="body2" component="span" sx={{ display: 'block' }}>
                                  <strong>Fases:</strong> {entry.details.phasesCount}
                                </Typography>
                              )}
                              {entry.details.durationMin !== undefined && (
                                <Typography variant="body2" component="span" sx={{ display: 'block' }}>
                                  <strong>Duración:</strong> {entry.details.durationMin} min
                                </Typography>
                              )}
                              {entry.details.newState !== undefined && entry.details.newState !== null && (
                                <Typography variant="body2" component="span" sx={{ display: 'block' }}>
                                  <strong>Estado:</strong> {entry.details.newState ? 'Encendido' : 'Apagado'}
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

          <Box ref={sentinelRef} sx={{ height: 1 }} />
          {loadingMore && (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={24} />
            </Box>
          )}
          {!hasMore && entries.length > 0 && (
            <Box py={2} textAlign="center">
              <Typography variant="body2" color="text.secondary">
                — Fin del historial —
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
