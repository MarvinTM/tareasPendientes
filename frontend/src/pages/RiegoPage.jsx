import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';

function formatRemaining(seconds) {
  if (seconds <= 0) return '0m 0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTotalDuration(phases) {
  const total = phases.reduce((sum, p) => sum + (p.durationMin || 0), 0);
  return total;
}

const DURATION_STORAGE_KEY = 'riego-durations';

function loadStoredDurations() {
  try {
    return JSON.parse(localStorage.getItem(DURATION_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStoredDurations(durations) {
  localStorage.setItem(DURATION_STORAGE_KEY, JSON.stringify(durations));
}

export default function RiegoPage() {
  const socket = useSocket();
  const [state, setState] = useState({ current: null, queue: [], phases: [], durationMemory: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const [plans, setPlans] = useState([]);
  const [confirmPlan, setConfirmPlan] = useState(null);
  const [durations, setDurations] = useState(loadStoredDurations);
  const [starting, setStarting] = useState({});

  const fetchState = useCallback(async () => {
    try {
      const response = await api.get('/riego/status');
      setState(response.data);
      setError(null);
    } catch (err) {
      setError('Error al cargar el estado del riego');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const response = await api.get('/riego/plans');
      setPlans(response.data);
    } catch {
      // Silently ignore plans fetch errors
    }
  }, []);

  useEffect(() => {
    fetchState();
    fetchPlans();
  }, [fetchState, fetchPlans]);

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data) => {
      setState(data);
    };

    socket.on('riego:updated', handleUpdate);
    return () => socket.off('riego:updated', handleUpdate);
  }, [socket]);

  useEffect(() => {
    if (!state.current) return;

    const interval = setInterval(() => {
      setState(prev => {
        if (!prev.current) return prev;
        const remaining = Math.max(0, prev.current.remaining - 1);
        return {
          ...prev,
          current: { ...prev.current, remaining },
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.current?.queueId]);

  const handleStart = async (phaseId) => {
    const duration = durations[phaseId] || 10;
    if (!duration || duration <= 0 || duration > 120) return;

    setStarting(prev => ({ ...prev, [phaseId]: true }));
    try {
      await api.post('/riego/start', { phaseId, durationMin: duration });
      saveStoredDurations(durations);
    } catch (err) {
      setSnackbar(err.response?.data?.error || 'Error al activar la fase');
    } finally {
      setStarting(prev => ({ ...prev, [phaseId]: false }));
    }
  };

  const handleStop = async () => {
    try {
      await api.post('/riego/stop');
    } catch {
      setSnackbar('Error al detener el riego');
    }
  };

  const handleDequeue = async (queueId) => {
    try {
      await api.delete(`/riego/queue/${queueId}`);
    } catch {
      setSnackbar('Error al eliminar de la cola');
    }
  };

  const handleTriggerPlan = async () => {
    if (!confirmPlan) return;
    try {
      await api.post(`/riego/plans/${confirmPlan.id}/trigger`);
    } catch {
      setSnackbar('Error al activar el plan');
    }
    setConfirmPlan(null);
  };

  const handleDurationChange = (phaseId, value) => {
    const num = Number(value);
    if (num > 120) return;
    const newDurations = { ...durations, [phaseId]: num || 0 };
    setDurations(newDurations);
    saveStoredDurations(newDurations);
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
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WaterDropIcon fontSize="large" color="primary" /> Riego
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Phases Section */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>Fases</Typography>
          <Grid container spacing={2}>
            {state.phases.map(phase => (
              <Grid item xs={12} key={phase.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <WaterDropIcon color="primary" />
                        <Typography variant="subtitle1" fontWeight="bold">
                          {phase.name}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <TextField
                          type="number"
                          size="small"
                          value={durations[phase.id] || 10}
                          onChange={(e) => handleDurationChange(phase.id, e.target.value)}
                          inputProps={{ min: 1, max: 120, style: { width: 50, textAlign: 'center' } }}
                          sx={{ width: 80 }}
                          disabled={false}
                        />
                        <Typography variant="caption" color="text.secondary">min</Typography>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={starting[phase.id] ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                          onClick={() => handleStart(phase.id)}
                          disabled={starting[phase.id] || !durations[phase.id] || durations[phase.id] <= 0}
                        >
                          Activar
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Queue Section */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Cola de riego
          </Typography>
          <Paper>
            {!state.current && state.queue.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">Cola vacía</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {state.current && (
                  <ListItem sx={{ backgroundColor: 'primary.light', color: 'primary.contrastText' }}>
                    <Box display="flex" alignItems="center" gap={1} mr={1}>
                      <PlayArrowIcon />
                    </Box>
                    <ListItemText
                      primary={`${state.current.name} — ${state.current.durationMin} min`}
                      secondary={
                        <Box component="span" display="flex" alignItems="center" gap={0.5}>
                          <AccessTimeIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption">
                            Quedan {formatRemaining(state.current.remaining)}
                          </Typography>
                        </Box>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                    <IconButton onClick={handleStop} sx={{ color: 'inherit' }}>
                      <StopIcon />
                    </IconButton>
                  </ListItem>
                )}
                {state.queue.map((item, index) => (
                  <Box key={item.queueId}>
                    {index > 0 || state.current ? <Divider /> : null}
                    <ListItem>
                      <Box display="flex" alignItems="center" gap={1} mr={1}>
                        <HourglassEmptyIcon color="action" />
                      </Box>
                      <ListItemText
                        primary={`${item.name} — ${item.durationMin} min`}
                        secondary={
                          <Chip label="En espera" size="small" variant="outlined" sx={{ mt: 0.5 }} />
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                      <IconButton onClick={() => handleDequeue(item.queueId)} size="small">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Plans Section */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>Planes guardados</Typography>

        {plans.length === 0 ? (
          <Card sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No hay planes guardados.{' '}
              <Button size="small" onClick={() => {}} sx={{ textTransform: 'none' }}>
                Crear uno
              </Button>
            </Typography>
          </Card>
        ) : (
          plans.map(plan => (
            <Card key={plan.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">{plan.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {plan.phases.map(p => {
                        const phase = state.phases.find(ph => ph.id === p.phaseId);
                        return `${phase?.name || p.phaseId} ${p.durationMin}m`;
                      }).join(' → ')}
                    </Typography>
                    <Chip
                      label={`Total: ${formatTotalDuration(plan.phases)} min`}
                      size="small"
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => setConfirmPlan(plan)}
                  >
                    Activar plan
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))
        )}
      </Box>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />

      <Dialog open={Boolean(confirmPlan)} onClose={() => setConfirmPlan(null)}>
        <DialogTitle>Activar plan de riego</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Añadir plan "{confirmPlan?.name}" ({confirmPlan?.phases?.length || 0} fases, {formatTotalDuration(confirmPlan?.phases || [])} min total) a la cola?
          </Typography>
          {confirmPlan?.phases?.map((p, i) => {
            const phase = state.phases.find(ph => ph.id === p.phaseId);
            return (
              <Typography key={i} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {i + 1}. {phase?.name || p.phaseId} — {p.durationMin} min
              </Typography>
            );
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPlan(null)}>Cancelar</Button>
          <Button onClick={handleTriggerPlan} variant="contained" color="primary">
            Añadir a la cola
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
