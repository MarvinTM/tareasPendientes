import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ErrorIcon from '@mui/icons-material/Error';
import api from '../services/api';

const eventConfig = {
  STARTED: { label: 'Iniciada', icon: PlayArrowIcon, color: 'success' },
  STOPPED: { label: 'Detenida', icon: StopIcon, color: 'info' },
  ERROR: { label: 'Error', icon: ErrorIcon, color: 'error' },
};

const stopReasonLabels = {
  manual: 'Manual',
  timeout: 'Por tiempo',
  watchdog: 'Watchdog',
  emergency: 'Emergencia',
};

export default function RiegoEventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, [page]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/riego/events?page=${page}&limit=30`);
      setEvents(response.data.events);
      setPagination(response.data.pagination);
      setError(null);
    } catch (err) {
      setError('Error al cargar el historial de eventos');
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
    <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, pb: { xs: 7, md: 0 } }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WaterDropIcon fontSize="large" color="primary" /> Histórico de Riegos
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {events.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No hay eventos registrados.</Typography>
        </Paper>
      ) : (
        <>
          <Paper>
            <List>
              {events.map((entry, index) => {
                const config = eventConfig[entry.event] || { label: entry.event, icon: ErrorIcon, color: 'default' };
                const EventIcon = config.icon;

                return (
                  <Box key={entry.id}>
                    {index > 0 && <Divider />}
                    <ListItem alignItems="flex-start">
                      <ListItemIcon>
                        <EventIcon color={config.color} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                            <Chip
                              label={config.label}
                              color={config.color}
                              size="small"
                            />
                            <Typography component="span" fontWeight="medium">
                              {entry.phaseName}
                            </Typography>
                            {entry.event === 'STOPPED' && entry.stopReason && (
                              <Chip
                                label={stopReasonLabels[entry.stopReason] || entry.stopReason}
                                size="small"
                                variant="outlined"
                                color="info"
                              />
                            )}
                            {entry.user && (
                              <Typography variant="body2" color="text.secondary" component="span">
                                por {entry.user.name}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={
                          <Box component="span" sx={{ display: 'block' }}>
                            <Typography variant="body2" color="text.secondary" component="span">
                              {new Date(entry.timestamp).toLocaleString()}
                            </Typography>
                            {entry.error && (
                              <Typography variant="body2" color="error" component="span" sx={{ display: 'block', mt: 0.5 }}>
                                {entry.error}
                              </Typography>
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
