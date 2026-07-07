import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
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
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ScheduleIcon from '@mui/icons-material/Schedule';
import api from '../services/api';

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
    setDialogOpen(true);
  };

  const handleOpenEdit = (plan) => {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setActivationTime(plan.activationTime);
    setDeactivationTime(plan.deactivationTime);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const handleSave = async () => {
    if (!planName.trim()) return;
    if (!activationTime || !deactivationTime) return;
    if (activationTime >= deactivationTime) {
      setSnackbar('La hora de activación debe ser anterior a la de desactivación');
      return;
    }

    setSaving(true);
    try {
      const payload = { name: planName.trim(), activationTime, deactivationTime };

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
        plans.map(plan => (
          <Card key={plan.id} sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="h6">{plan.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <AccessTimeIcon fontSize="small" />
                    {plan.activationTime} — {plan.deactivationTime}
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
        ))
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
            <TextField
              label="Hora de activación"
              type="time"
              value={activationTime}
              onChange={(e) => setActivationTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 60 }}
              fullWidth
            />
            <TextField
              label="Hora de desactivación"
              type="time"
              value={deactivationTime}
              onChange={(e) => setDeactivationTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 60 }}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!planName.trim() || !activationTime || !deactivationTime || saving}
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
