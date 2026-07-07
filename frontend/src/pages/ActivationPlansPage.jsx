import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTimes } from 'suncalc';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WbTwilightIcon from '@mui/icons-material/WbTwilight';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import api from '../services/api';

const ALBERITE = { lat: 42.4067, lng: -2.4381 };

function getSunTime(type) {
  const times = getTimes(new Date(), ALBERITE.lat, ALBERITE.lng);
  const date = type === 'sunrise' ? times.sunrise : times.sunset;
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatModeLabel(mode, fixedTime) {
  if (mode === 'sunrise') return 'Amanecer';
  if (mode === 'sunset') return 'Anochecer';
  return fixedTime;
}

function formatCardMode(mode, fixedTime) {
  if (mode === 'sunrise') return `Amanecer (~${getSunTime('sunrise')})`;
  if (mode === 'sunset') return `Anochecer (~${getSunTime('sunset')})`;
  return fixedTime;
}

export default function ActivationPlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planName, setPlanName] = useState('');
  const [activationTime, setActivationTime] = useState('');
  const [deactivationTime, setDeactivationTime] = useState('');
  const [activationMode, setActivationMode] = useState('fixed');
  const [deactivationMode, setDeactivationMode] = useState('fixed');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchPlans = useCallback(async () => {
    try {
      const response = await api.get('/devices/activation-plans');
      setPlans(response.data);
      setError(null);
    } catch {
      setError('Error al cargar los planes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setPlanName('');
    setActivationTime('');
    setDeactivationTime('');
    setActivationMode('fixed');
    setDeactivationMode('fixed');
    setDialogOpen(true);
  };

  const handleOpenEdit = (plan) => {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setActivationTime(plan.activationTime);
    setDeactivationTime(plan.deactivationTime);
    setActivationMode(plan.activationMode || 'fixed');
    setDeactivationMode(plan.deactivationMode || 'fixed');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const handleSave = async () => {
    if (!planName.trim()) return;

    if (activationMode === 'fixed' && !activationTime) return;
    if (deactivationMode === 'fixed' && !deactivationTime) return;

    if (activationMode === 'fixed' && deactivationMode === 'fixed' && activationTime >= deactivationTime) {
      setSnackbar('La hora de activación debe ser anterior a la de desactivación');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: planName.trim(),
        activationTime: activationMode === 'fixed' ? activationTime : '00:00',
        deactivationTime: deactivationMode === 'fixed' ? deactivationTime : '00:00',
        activationMode,
        deactivationMode,
      };

      if (editingPlan) {
        await api.patch(`/devices/activation-plans/${editingPlan.id}`, payload);
      } else {
        await api.post('/devices/activation-plans', payload);
      }
      handleCloseDialog();
      fetchPlans();
    } catch (err) {
      setSnackbar(err.response?.data?.error || 'Error al guardar el plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/devices/activation-plans/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      fetchPlans();
    } catch {
      setSnackbar('Error al eliminar el plan');
      setDeleteConfirm(null);
    }
  };

  const isSaveDisabled = (() => {
    if (!planName.trim()) return true;
    if (activationMode === 'fixed' && !activationTime) return true;
    if (deactivationMode === 'fixed' && !deactivationTime) return true;
    return saving;
  })();

  const sunriseTime = getSunTime('sunrise');
  const sunsetTime = getSunTime('sunset');

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
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScheduleIcon fontSize="large" color="primary" /> Planes de Activación
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Nuevo Plan
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {plans.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No hay planes de activación.</Typography>
        </Card>
      ) : (
        plans.map(plan => {
          const actMode = plan.activationMode || 'fixed';
          const deactMode = plan.deactivationMode || 'fixed';
          const actLabel = formatCardMode(actMode, plan.activationTime);
          const deactLabel = formatCardMode(deactMode, plan.deactivationTime);

          return (
            <Card key={plan.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                  <Box>
                    <Typography variant="h6">{plan.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <AccessTimeIcon fontSize="small" />
                      {actLabel} — {deactLabel}
                    </Typography>
                  </Box>
                  <Box display="flex" gap={0.5}>
                    <IconButton size="small" onClick={() => handleOpenEdit(plan)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteConfirm(plan)}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })
      )}

      <Box sx={{ mt: 2 }}>
        <Button variant="text" onClick={() => navigate('/dispositivos')}>
          ← Volver a dispositivos
        </Button>
      </Box>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPlan ? 'Editar Plan' : 'Nuevo Plan de Activación'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Nombre del plan"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              fullWidth
              required
            />

            {/* Activation */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Activación
              </Typography>
              <ToggleButtonGroup
                value={activationMode}
                exclusive
                onChange={(_, val) => val && setActivationMode(val)}
                size="small"
                fullWidth
              >
                <ToggleButton value="fixed">
                  <Tooltip title="Hora fija">
                    <ScheduleIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="sunrise">
                  <Tooltip title={`Se activará dinámicamente al amanecer, dependiendo del momento del año. Actualmente: ${sunriseTime}`}>
                    <Brightness7Icon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="sunset">
                  <Tooltip title={`Se activará dinámicamente al anochecer, dependiendo del momento del año. Actualmente: ${sunsetTime}`}>
                    <WbTwilightIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
              {activationMode === 'fixed' ? (
                <TextField
                  label="Hora de activación"
                  type="time"
                  value={activationTime}
                  onChange={(e) => setActivationTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 60 }}
                  fullWidth
                  sx={{ mt: 1 }}
                />
              ) : (
                <TextField
                  label="Hora de activación"
                  value={activationMode === 'sunrise' ? 'Amanecer' : 'Anochecer'}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  disabled
                  helperText={`Actualmente ~${activationMode === 'sunrise' ? sunriseTime : sunsetTime}`}
                  sx={{ mt: 1 }}
                />
              )}
            </Box>

            {/* Deactivation */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Desactivación
              </Typography>
              <ToggleButtonGroup
                value={deactivationMode}
                exclusive
                onChange={(_, val) => val && setDeactivationMode(val)}
                size="small"
                fullWidth
              >
                <ToggleButton value="fixed">
                  <Tooltip title="Hora fija">
                    <ScheduleIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="sunrise">
                  <Tooltip title={`Se desactivará dinámicamente al amanecer, dependiendo del momento del año. Actualmente: ${sunriseTime}`}>
                    <Brightness7Icon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="sunset">
                  <Tooltip title={`Se desactivará dinámicamente al anochecer, dependiendo del momento del año. Actualmente: ${sunsetTime}`}>
                    <WbTwilightIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
              {deactivationMode === 'fixed' ? (
                <TextField
                  label="Hora de desactivación"
                  type="time"
                  value={deactivationTime}
                  onChange={(e) => setDeactivationTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 60 }}
                  fullWidth
                  sx={{ mt: 1 }}
                />
              ) : (
                <TextField
                  label="Hora de desactivación"
                  value={deactivationMode === 'sunrise' ? 'Amanecer' : 'Anochecer'}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  disabled
                  helperText={`Actualmente ~${deactivationMode === 'sunrise' ? sunriseTime : sunsetTime}`}
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={isSaveDisabled}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Eliminar Plan</DialogTitle>
        <DialogContent>
          ¿Estás seguro de eliminar el plan "{deleteConfirm?.name}"?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />
    </Box>
  );
}
