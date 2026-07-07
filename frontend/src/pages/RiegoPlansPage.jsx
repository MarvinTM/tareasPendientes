import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../services/api';

const DURATION_OPTIONS = [
  { label: '10 seg', value: 10 / 60 },
  { label: '1 min', value: 1 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hora', value: 60 },
];

const DEFAULT_DURATION = 10;

function formatDuration(minutes) {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)} seg`;
  }
  if (minutes === 60) return '1 hora';
  return `${Math.round(minutes)} min`;
}

function formatPlansTotal(phases) {
  const total = phases.reduce((s, p) => s + p.durationMin, 0);
  if (total < 1) return `${Math.round(total * 60)} seg`;
  if (total === 60) return '1 hora';
  if (total > 60) {
    const h = Math.floor(total / 60);
    const m = Math.round(total % 60);
    return m > 0 ? `${h}h ${m}min` : `${h} horas`;
  }
  return `${Math.round(total)} min`;
}

export default function RiegoPlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [riegoState, setRiegoState] = useState({ phases: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planName, setPlanName] = useState('');
  const [planPhases, setPlanPhases] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [plansRes, statusRes] = await Promise.all([
        api.get('/riego/plans'),
        api.get('/riego/status'),
      ]);
      setPlans(plansRes.data);
      setRiegoState(statusRes.data);
      setError(null);
    } catch {
      setError('Error al cargar los planes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setPlanName('');
    setPlanPhases([]);
    setDialogOpen(true);
  };

  const handleOpenEdit = (plan) => {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanPhases(plan.phases.map(p => ({ ...p })));
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
    setPlanName('');
    setPlanPhases([]);
  };

  const handleAddPhase = () => {
    if (riegoState.phases.length === 0) return;
    setPlanPhases([...planPhases, { phaseId: riegoState.phases[0].id, durationMin: DEFAULT_DURATION }]);
  };

  const handleRemovePhase = (index) => {
    setPlanPhases(planPhases.filter((_, i) => i !== index));
  };

  const handlePhaseChange = (index, field, value) => {
    const updated = [...planPhases];
    updated[index] = { ...updated[index], [field]: field === 'durationMin' ? Number(value) || 0 : value };
    setPlanPhases(updated);
  };

  const handleMovePhase = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= planPhases.length) return;
    const updated = [...planPhases];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setPlanPhases(updated);
  };

  const handleSave = async () => {
    if (!planName.trim() || planPhases.length === 0) return;

    setSaving(true);
    try {
      const payload = { name: planName.trim(), phases: planPhases };

      if (editingPlan) {
        await api.patch(`/riego/plans/${editingPlan.id}`, payload);
      } else {
        await api.post('/riego/plans', payload);
      }
      handleCloseDialog();
      fetchData();
    } catch (err) {
      setSnackbar(err.response?.data?.error || 'Error al guardar el plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/riego/plans/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      fetchData();
    } catch {
      setSnackbar('Error al eliminar el plan');
      setDeleteConfirm(null);
    }
  };

  const handleDragEnd = async (result) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;

    const updated = [...plans];
    const [moved] = updated.splice(source.index, 1);
    updated.splice(destination.index, 0, moved);
    setPlans(updated);
    try {
      await api.patch('/riego/plans/reorder', { planIds: updated.map(p => p.id) });
    } catch {
      setSnackbar('Error al reordenar los planes');
      fetchData();
    }
  };

  const getPhaseName = (phaseId) => {
    return riegoState.phases.find(p => p.id === phaseId)?.name || phaseId;
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
          <FormatListBulletedIcon fontSize="large" color="primary" /> Planes de Riego
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
          <Typography color="text.secondary">No hay planes guardados.</Typography>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="plans">
            {(provided) => (
              <Box ref={provided.innerRef} {...provided.droppableProps}>
                {plans.map((plan, index) => (
                  <Draggable key={plan.id} draggableId={plan.id} index={index}>
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        sx={{
                          mb: 2,
                          ...(snapshot.isDragging ? { boxShadow: 4 } : {}),
                        }}
                      >
                        <CardContent>
                          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                            <Box flex={1} minWidth={0}>
                              <Typography variant="h6">{plan.name}</Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {plan.phases.map((p, i) => (
                                  <span key={i}>
                                    {i > 0 && ' → '}
                                    {getPhaseName(p.phaseId)} — {formatDuration(p.durationMin)}
                                  </span>
                                ))}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {plan.phases.length} fases · Total: {formatPlansTotal(plan.phases)}
                              </Typography>
                            </Box>
                            <Box display="flex" gap={0.5} alignItems="center">
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
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <Box sx={{ mt: 2 }}>
        <Button variant="text" onClick={() => navigate('/riego')}>
          ← Volver al control de riego
        </Button>
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPlan ? 'Editar Plan' : 'Nuevo Plan de Riego'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Nombre del plan"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              fullWidth
              required
            />

            <Divider />

            <Typography variant="subtitle2" color="text.secondary">
              Fases del plan ({planPhases.length})
            </Typography>

            {planPhases.map((p, index) => (
              <Box key={index} display="flex" gap={1} alignItems="center">
                <FormControl size="small" sx={{ flex: 2 }}>
                  <Select
                    value={p.phaseId}
                    onChange={(e) => handlePhaseChange(index, 'phaseId', e.target.value)}
                  >
                    {riegoState.phases.map(phase => (
                      <MenuItem key={phase.id} value={phase.id}>{phase.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 110 }}>
                  <Select
                    value={p.durationMin}
                    onChange={(e) => handlePhaseChange(index, 'durationMin', e.target.value)}
                  >
                    {DURATION_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton size="small" onClick={() => handleMovePhase(index, -1)} disabled={index === 0}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => handleMovePhase(index, 1)} disabled={index === planPhases.length - 1}>
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => handleRemovePhase(index)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}

            <Button startIcon={<AddIcon />} onClick={handleAddPhase}>
              Añadir fase
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!planName.trim() || planPhases.length === 0 || saving}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
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
