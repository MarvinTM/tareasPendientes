import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef(null);

  const fetchEvents = useCallback(async (before) => {
    try {
      if (before) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const params = { limit: 30 };
      if (before) params.before = before;
      const response = await api.get('/riego/events', { params });
      if (before) {
        setEvents(prev => [...prev, ...response.data.events]);
      } else {
        setEvents(response.data.events);
      }
      setNextCursor(response.data.nextCursor);
      setHasMore(response.data.hasMore);
      setError(null);
    } catch (err) {
      setError('Error al cargar el historial de eventos');
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(null);
  }, [fetchEvents]);

  useEffect(() => {
    if (!nextCursor) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchEvents(nextCursor);
      }
    }, { threshold: 0.1 });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, hasMore, loadingMore, fetchEvents]);

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

          <Box ref={sentinelRef} sx={{ height: 1 }} />
          {loadingMore && (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={24} />
            </Box>
          )}
          {!hasMore && events.length > 0 && (
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
