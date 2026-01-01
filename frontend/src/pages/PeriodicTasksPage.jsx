import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LoopIcon from '@mui/icons-material/Loop';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import api from '../services/api';
import UserAvatar from '../components/UserAvatar';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const sizeConfig = {
  Pequena: { label: 'S', color: '#4caf50', tooltip: 'Pequeña' },
  Mediana: { label: 'M', color: '#ff9800', tooltip: 'Mediana' },
  Grande: { label: 'L', color: '#f44336', tooltip: 'Grande' }
};

export default function PeriodicTasksPage() {
  const [tab, setTab] = useState(0); // 0 = Weekly, 1 = Monthly
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Dialog State
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [dialogForm, setDialogForm] = useState({
    title: '',
    description: '',
    size: 'Pequena',
    categoryId: '',
    assignedToId: '',
    frequency: 'WEEKLY',
    dayOfWeek: 1, // Default Monday
    monthOfYear: 0 // Default January
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, catsRes, usersRes] = await Promise.all([
        api.get('/periodic-tasks'),
        api.get('/categories'),
        api.get('/users')
      ]);
      setTasks(tasksRes.data);
      setCategories(catsRes.data);
      setUsers(usersRes.data);
      setError(null);
    } catch (err) {
      setError('Error al cargar las tareas recurrentes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    // Reset form frequency when switching tabs
    setDialogForm(prev => ({
      ...prev,
      frequency: newValue === 0 ? 'WEEKLY' : 'MONTHLY'
    }));
  };

  const handleOpenDialog = (task = null, defaultDayOrMonth = null) => {
    if (task) {
      setEditingTask(task);
      setDialogForm({
        title: task.title,
        description: task.description || '',
        size: task.size,
        categoryId: task.categoryId,
        assignedToId: task.assignedToId || '',
        frequency: task.frequency,
        dayOfWeek: task.dayOfWeek ?? 1,
        monthOfYear: task.monthOfYear ?? 0
      });
    } else {
      setEditingTask(null);
      setDialogForm({
        title: '',
        description: '',
        size: 'Pequena',
        categoryId: categories[0]?.id || '',
        assignedToId: '',
        frequency: tab === 0 ? 'WEEKLY' : 'MONTHLY',
        dayOfWeek: tab === 0 ? (defaultDayOrMonth ?? 1) : 1,
        monthOfYear: tab === 1 ? (defaultDayOrMonth ?? 0) : 0
      });
    }
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!dialogForm.title.trim() || !dialogForm.categoryId) return;

    setSaving(true);
    try {
      if (editingTask) {
        await api.patch(`/periodic-tasks/${editingTask.id}`, dialogForm);
      } else {
        await api.post('/periodic-tasks', dialogForm);
      }
      setOpenDialog(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Error al guardar la tarea recurrente');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/periodic-tasks/${deleteConfirm.id}?deletePending=${deletePending}`);
      setDeleteConfirm(null);
      setDeletePending(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Error al eliminar la tarea recurrente');
    }
  };

  const renderTaskList = (filteredTasks) => (
    <List dense>
      {filteredTasks.map((task) => (
        <ListItem
          key={task.id}
          sx={{
            border: '1px dashed #e0e0e0',
            borderRadius: 1,
            mb: 1,
            '&:hover': { bgcolor: 'action.hover' }
          }}
        >
          <Box display="flex" alignItems="center" mr={2}>
            <Tooltip title={task.category?.name}>
              <Typography sx={{ fontSize: '1.2rem' }}>
                {task.category?.emoji || '📋'}
              </Typography>
            </Tooltip>
          </Box>
          
          <ListItemText
            primary={
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle2">{task.title}</Typography>
                <LoopIcon sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7 }} />
              </Box>
            }
            secondary={
              <Box component="span" display="flex" flexDirection="column" gap={0.5}>
                {task.description && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {task.description}
                  </Typography>
                )}
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip 
                    label={sizeConfig[task.size].label} 
                    size="small" 
                    sx={{ 
                      height: 20, 
                      fontSize: '0.65rem', 
                      bgcolor: sizeConfig[task.size].color, 
                      color: 'white',
                      fontWeight: 'bold'
                    }} 
                  />
                  {task.assignedTo && (
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography variant="caption" color="text.secondary">Asignada a:</Typography>
                      <UserAvatar user={task.assignedTo} sx={{ width: 24, height: 24 }} showTooltip={true} />
                    </Box>
                  )}
                </Box>
              </Box>
            }
          />

          <Box>
            <IconButton size="small" onClick={() => handleOpenDialog(task)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setDeleteConfirm(task)} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </ListItem>
      ))}
      {filteredTasks.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1, fontStyle: 'italic' }}>
          No hay tareas recurrentes definidas.
        </Typography>
      )}
    </List>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box pb={8}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LoopIcon fontSize="large" color="primary" /> Tareas recurrentes
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Define tareas que se generarán automáticamente de forma recurrente.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={handleTabChange} variant="fullWidth">
          <Tab label="Semanales" />
          <Tab label="Mensuales" />
        </Tabs>
      </Paper>

      {/* Weekly View */}
      {tab === 0 && (
        <Box>
          {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
            const dayTasks = tasks.filter(t => t.frequency === 'WEEKLY' && t.dayOfWeek === dayIndex);
            
            return (
              <Accordion key={dayIndex} defaultExpanded={dayTasks.length > 0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" pr={2}>
                    <Typography fontWeight="bold" color="primary.main">
                      {DAYS[dayIndex]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dayTasks.length} tarea{dayTasks.length !== 1 ? 's' : ''} recurrente{dayTasks.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {renderTaskList(dayTasks)}
                  <Button 
                    startIcon={<AddIcon />} 
                    size="small" 
                    sx={{ mt: 1 }}
                    onClick={() => handleOpenDialog(null, dayIndex)}
                  >
                    Agregar a {DAYS[dayIndex]}
                  </Button>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      )}

      {/* Monthly View */}
      {tab === 1 && (
        <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={2}>
          {MONTHS.map((monthName, index) => {
            const monthTasks = tasks.filter(t => t.frequency === 'MONTHLY' && t.monthOfYear === index);
            
            return (
              <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="h6" color="primary.main">
                    {monthName}
                  </Typography>
                  <Chip 
                    label={monthTasks.length} 
                    size="small" 
                    color={monthTasks.length > 0 ? "primary" : "default"} 
                    variant={monthTasks.length > 0 ? "filled" : "outlined"}
                  />
                </Box>
                
                {renderTaskList(monthTasks)}
                
                <Button 
                  startIcon={<AddIcon />} 
                  size="small" 
                  fullWidth
                  sx={{ mt: 1 }}
                  onClick={() => handleOpenDialog(null, index)}
                >
                  Agregar a {monthName}
                </Button>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Main Add Button (Floating) */}
      <Fab 
        color="primary" 
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => handleOpenDialog()}
      >
        <AddIcon />
      </Fab>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTask ? 'Editar tarea recurrente' : 'Nueva tarea recurrente'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Título"
              value={dialogForm.title}
              onChange={(e) => setDialogForm({ ...dialogForm, title: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Descripción"
              value={dialogForm.description}
              onChange={(e) => setDialogForm({ ...dialogForm, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            
            <Box display="flex" gap={2}>
              <FormControl fullWidth required>
                <InputLabel>Categoría</InputLabel>
                <Select
                  value={dialogForm.categoryId}
                  onChange={(e) => setDialogForm({ ...dialogForm, categoryId: e.target.value })}
                  label="Categoría"
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.emoji} {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Asignar a</InputLabel>
                <Select
                  value={dialogForm.assignedToId}
                  onChange={(e) => setDialogForm({ ...dialogForm, assignedToId: e.target.value })}
                  label="Asignar a"
                >
                  <MenuItem value=""><em>Sin asignar</em></MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <UserAvatar user={user} sx={{ width: 24, height: 24 }} showTooltip={false} />
                        {user.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Dificultad
              </Typography>
              <ToggleButtonGroup
                value={dialogForm.size}
                exclusive
                onChange={(e, val) => val && setDialogForm({ ...dialogForm, size: val })}
                fullWidth
                size="small"
              >
                {Object.entries(sizeConfig).map(([key, config]) => (
                  <ToggleButton key={key} value={key} sx={{ color: config.color }}>
                    {config.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Divider />

            <FormControl fullWidth>
              <InputLabel>Frecuencia</InputLabel>
              <Select
                value={dialogForm.frequency}
                onChange={(e) => setDialogForm({ ...dialogForm, frequency: e.target.value })}
                label="Frecuencia"
              >
                <MenuItem value="WEEKLY">Semanal</MenuItem>
                <MenuItem value="MONTHLY">Mensual</MenuItem>
              </Select>
            </FormControl>

            {dialogForm.frequency === 'WEEKLY' ? (
              <FormControl fullWidth>
                <InputLabel>Día de la Semana</InputLabel>
                <Select
                  value={dialogForm.dayOfWeek}
                  onChange={(e) => setDialogForm({ ...dialogForm, dayOfWeek: e.target.value })}
                  label="Día de la Semana"
                >
                  {DAYS.map((day, idx) => (
                    <MenuItem key={idx} value={idx}>{day}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <FormControl fullWidth>
                <InputLabel>Mes</InputLabel>
                <Select
                  value={dialogForm.monthOfYear}
                  onChange={(e) => setDialogForm({ ...dialogForm, monthOfYear: e.target.value })}
                  label="Mes"
                >
                  {MONTHS.map((month, idx) => (
                    <MenuItem key={idx} value={idx}>{month}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={!dialogForm.title.trim() || !dialogForm.categoryId || saving}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => { setDeleteConfirm(null); setDeletePending(false); }}>
        <DialogTitle>Eliminar tarea recurrente</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            ¿Estás seguro de eliminar "{deleteConfirm?.title}"?
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={deletePending}
                onChange={(e) => setDeletePending(e.target.checked)}
                color="primary"
              />
            }
            label="Eliminar también las tareas pendientes generadas por esta tarea recurrente"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteConfirm(null); setDeletePending(false); }}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
